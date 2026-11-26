import {
	CaretDownIcon,
	CaretRightIcon,
	CheckIcon,
	MinusIcon,
	PlusIcon,
	ShoppingCartIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import {
	Link,
	useBlocker,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from 'framer-motion'
import {
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { WithBrand } from '@/components/brand-field'
import { groceryCountKey, showAdded } from '@/components/grocery-badge'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { ReadyBar } from '@/components/ready-bar'
import {
	amountShown,
	together,
	withAmountSaid,
	type RecipeShop,
} from '@/components/recipe-shop'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { undoToast } from '@/components/undo-toast'
import { type Plan, usePlan, usePlanWrites } from '@/components/use-plans'
import { rememberAfterSignIn, takeAfterSignIn } from '@/lib/auth/after-sign-in'
import { amountApart, stepShopping } from '@/lib/groceries/amounts'
import {
	addGroceries,
	deleteGrocery,
	leaveGrocery,
	renameGrocery,
} from '@/lib/groceries/server'
import type { Readiness as ReadyCount } from '@/lib/pantry/readiness'
import {
	deletePantryItem,
	haveFood,
	setPantryItemLevel,
} from '@/lib/pantry/server'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

type Row = RecipeShop['rows'][number]

const count = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`

const withLine =
	(line: string) =>
	(now: ReadonlySet<string>): ReadonlySet<string> =>
		new Set(now).add(line)

const withoutLines =
	(lines: readonly string[]) =>
	(now: ReadonlySet<string>): ReadonlySet<string> =>
		new Set([...now].filter((line) => !lines.includes(line)))

// A write that can be taken back: how, once it's made, or nothing when it
// failed.
type TakeBack = () => Promise<void>

// What a save just did, counted at once while the pantry and the list catch
// up: food said to be out, and food sent to the list. Each write hands back
// how to take it back, for the toast's undo.
function useShopTaps(recipeId: string) {
	const client = useQueryClient()
	const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set())
	const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set())
	const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set())
	const plans = usePlanWrites()

	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: ['groceries'] }),
			client.invalidateQueries({ queryKey: groceryCountKey }),
			client.invalidateQueries({ queryKey: ['pantry'] }),
		])

	// Every food goes on the list in the amount the recipe needs. One already
	// there for another recipe stays one line, with this recipe's share added.
	async function send(rows: readonly Row[]): Promise<TakeBack | undefined> {
		if (!rows.length) return async () => {}

		const lines = rows.map((row) => row.line)

		setSent((now) => new Set([...now, ...lines]))

		// Named here, so undo knows which lines to take off.
		const fresh = rows.flatMap((row) =>
			row.elsewhere ? [] : [{ id: crypto.randomUUID(), text: row.adds }],
		)

		const shared = rows.flatMap((row) =>
			row.elsewhere ? [{ ...row.elsewhere, adds: row.adds }] : [],
		)

		try {
			if (fresh.length)
				await addGroceries({
					data: fresh.map((line) => ({
						id: line.id,
						text: line.text.slice(0, 200),
						recipeIds: [recipeId],
					})),
				})

			for (const line of shared) {
				await addGroceries({
					data: [{ text: line.text.slice(0, 200), recipeIds: [recipeId] }],
				})
				await renameGrocery({
					data: {
						id: line.id,
						text: together(line.text, line.adds).slice(0, 200),
					},
				})
			}

			showAdded(rows.length)
			await refresh()

			// Off the list again: lines this made go, and ones shared with
			// another recipe go back to that recipe's share.
			return async () => {
				await Promise.all([
					...fresh.map((line) => deleteGrocery({ data: { id: line.id } })),
					...shared.map((line) =>
						leaveGrocery({
							data: { id: line.id, recipeId, text: line.text.slice(0, 200) },
						}),
					),
				])
			}
		} catch {
			toast.error("couldn't add those — try again")

			return undefined
		} finally {
			setSent(withoutLines(lines))
		}
	}

	// Run out: the pantry keeps the food, marked out.
	async function out(row: Row): Promise<TakeBack | undefined> {
		setGone(withLine(row.line))

		try {
			const item = row.item

			if (item)
				await setPantryItemLevel({ data: { id: item.id, level: 'out' } })

			await client.invalidateQueries({ queryKey: ['pantry'] })
			// Read again, the pantry says it: what it says from here on wins.
			setGone(withoutLines([row.line]))

			// Home again, at the level it had.
			return async () => {
				if (item)
					await setPantryItemLevel({
						data: { id: item.id, level: item.level },
					})

				setGone(withoutLines([row.line]))
			}
		} catch {
			toast.error(`couldn't mark ${row.name} out — try again`)
			setGone(withoutLines([row.line]))

			return undefined
		}
	}

	// Home after all: a staple not bought goes in the pantry, so recipes stop
	// asking for it. One the pantry knows is said to be plenty again.
	async function keep(row: Row): Promise<TakeBack | undefined> {
		setKept(withLine(row.line))

		try {
			const item = row.item

			if (item) {
				await setPantryItemLevel({ data: { id: item.id, level: 'plenty' } })
				await client.invalidateQueries({ queryKey: ['pantry'] })
				// Read again, the pantry says it: what it says from here on wins.
				setKept(withoutLines([row.line]))

				return async () => {
					await setPantryItemLevel({
						data: { id: item.id, level: item.level },
					})
					setKept(withoutLines([row.line]))
				}
			}

			const made = await haveFood({ data: { text: row.line.slice(0, 200) } })

			await client.invalidateQueries({ queryKey: ['pantry'] })
			setKept(withoutLines([row.line]))

			return async () => {
				await Promise.all(
					made.addedIds.map((id) => deletePantryItem({ data: { id } })),
				)
				setKept(withoutLines([row.line]))
			}
		} catch {
			toast.error(`couldn't put ${row.name} in your pantry — try again`)
			setKept(withoutLines([row.line]))

			return undefined
		}
	}

	// In progress, with what's skipped for it: the cook means to make it, and
	// what they skip holds until it's cooked.
	async function plan(
		skipped: string[],
		before: Plan | null,
	): Promise<TakeBack | undefined> {
		try {
			await plans.plan(recipeId, skipped)

			return () => plans.restore(recipeId, before)
		} catch {
			toast.error("couldn't save that — try again")

			return undefined
		}
	}

	// Said once the writes land, with one undo for all of them.
	function said(message: string, takeBacks: readonly TakeBack[]) {
		undoToast(
			message,
			() =>
				void Promise.all(takeBacks.map((takeBack) => takeBack()))
					.catch(() => {
						toast.error("couldn't undo that — try again")
					})
					.finally(() => void refresh()),
			'recipe-shop',
		)
	}

	const listed = (row: Row) => !!row.onList || sent.has(row.line)

	const home = (row: Row) =>
		!listed(row) && !gone.has(row.line) && (row.home || kept.has(row.line))

	return { send, out, keep, plan, said, listed, home }
}

// Things said once and remembered on this device, such as the tag over the
// pill. Without storage, what's been said is kept for this visit.
const seenListeners = new Set<() => void>()

const seenThisVisit = new Set<string>()

function subscribeSeen(listener: () => void) {
	seenListeners.add(listener)

	return () => {
		seenListeners.delete(listener)
	}
}

function readSeen(key: string) {
	if (seenThisVisit.has(key)) return true

	try {
		return localStorage.getItem(key) === '1'
	} catch {
		return false
	}
}

function markSeen(key: string) {
	seenThisVisit.add(key)

	try {
		localStorage.setItem(key, '1')
	} catch {
		// Not kept past this visit.
	}

	seenListeners.forEach((listener) => listener())
}

function useSeen(key: string) {
	return useSyncExternalStore(
		subscribeSeen,
		() => readSeen(key),
		() => true,
	)
}

// The first time a recipe says what's missing, a word over its pill says
// what tapping it does. Gone at the first tap anywhere.
const hintKey = 'readiness-hint-seen'

const markHintSeen = () => markSeen(hintKey)

const noSkips: ReadonlySet<string> = new Set()

// What the cook has changed in the sheet, none of it kept until they save:
// how much to buy, the foods stepped down to none, those said to be out,
// and staples said to be home after all.
type Draft = {
	amounts: Readonly<Record<string, string>>
	none: ReadonlySet<string>
	outs: ReadonlySet<string>
	homes: ReadonlySet<string>
	// What was skipped when the sheet opened, to tell what's new.
	skipped: ReadonlySet<string>
}

const noDraft: Draft = {
	amounts: {},
	none: new Set(),
	outs: new Set(),
	homes: new Set(),
	skipped: new Set(),
}

const sameLines = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
	a.size === b.size && [...a].every((line) => b.has(line))

// Whether a recipe is ready to cook from what's home: one pill that says
// what's missing, what's on the list, or that it's ready. It shows once the
// pantry knows something; until then the recipe is just a recipe.
export function ReadinessPill({
	recipeId,
	shop,
	className,
}: {
	recipeId: string
	shop: RecipeShop
	className?: string
}) {
	const pill = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	const [pantryOpen, setPantryOpen] = useState(false)
	const [draft, setDraft] = useState(noDraft)
	const [leaving, setLeaving] = useState(false)
	// A skipped staple the cook says they have, asked about before it goes
	// in the pantry.
	const [confirming, setConfirming] = useState<Row>()
	const [authOpen, setAuthOpen] = useState(false)
	const taps = useShopTaps(recipeId)
	const plan = usePlan(recipeId, shop.signedIn)
	const router = useRouter()

	const pathname = useRouterState({
		select: (now) => now.location.pathname,
	})

	const skips = useMemo(
		() => (plan.data ? new Set(plan.data.skipped) : noSkips),
		[plan.data],
	)

	const reduceMotion = useReducedMotion()
	const seen = useSeen(hintKey)

	const out = (row: Row) => open && draft.outs.has(row.line)
	const homed = (row: Row) => open && draft.homes.has(row.line)
	const listed = shop.rows.filter(taps.listed)

	// What was just said to be home leads, so the cook sees where it went.
	const inPantry = [
		...shop.rows.filter(homed),
		...shop.rows.filter((row) => taps.home(row) && !out(row) && !homed(row)),
	]

	const toBuy = shop.rows.filter(
		(row) => !taps.listed(row) && (!taps.home(row) || out(row)) && !homed(row),
	)

	// Down to none, a food is skipped: in the sheet, as the cook has it so
	// far; closed, as it was last saved.
	const none = (row: Row) =>
		open ? draft.none.has(row.line) : skips.has(row.line)

	const buying = toBuy.filter((row) => !none(row))

	// The pill and the sheet's heading say how things stand as saved, so
	// they hold still while the cook changes things in the sheet.
	const missing = shop.rows.filter(
		(row) => !taps.listed(row) && !taps.home(row) && !skips.has(row.line),
	)

	// With an empty pantry nothing is known to be home, so nothing is said
	// to be missing: the pill only offers to shop for it, in the same sheet.
	// Signed out, the pill still offers to shop, and asks for an account
	// first, since the list is kept by one.
	const asking = shop.signedOut && shop.rows.length > 0

	const state = asking
		? 'add'
		: missing.length
			? shop.stocked
				? 'missing'
				: 'add'
			: listed.length
				? 'listed'
				: 'ready'

	const shown = shop.known && plan.isSuccess && shop.rows.length > 0

	// Under the heading, the bar counts as the shelf's tiles do: a food
	// skipped for this recipe isn't needed, unless it's home or listed after
	// all. With nothing in the pantry, it would say nothing.
	const needed = shop.rows.filter(
		(row) => taps.listed(row) || taps.home(row) || !skips.has(row.line),
	)

	const ready: ReadyCount | undefined =
		shown && shop.stocked && needed.length
			? {
					home: needed.filter(taps.home).length,
					listed: needed.filter(taps.listed).length,
					total: needed.length,
				}
			: undefined

	const hint = shown && state === 'missing' && !seen

	useEffect(() => {
		if (!hint) return

		document.addEventListener('pointerdown', markHintSeen, { once: true })

		return () => document.removeEventListener('pointerdown', markHintSeen)
	}, [hint])

	const amount = (row: Row) => draft.amounts[row.line] ?? row.adds

	const changed =
		open &&
		(draft.outs.size > 0 ||
			draft.homes.size > 0 ||
			!sameLines(draft.none, draft.skipped) ||
			toBuy.some((row) => amount(row) !== row.adds))

	// Leaving the page with changes asks first too, however it's left: back,
	// a link in the sheet, or (with the browser's own prompt) a reload.
	const blocker = useBlocker({
		shouldBlockFn: ({ current, next }) =>
			changed && current.pathname !== next.pathname,
		enableBeforeUnload: () => changed,
		withResolver: true,
	})

	function openSheet() {
		const skipped = new Set(
			toBuy.filter((row) => skips.has(row.line)).map((row) => row.line),
		)

		setDraft({ ...noDraft, none: skipped, skipped })
		// Ready, the pantry's foods are all there is to show.
		setPantryOpen(state === 'ready')
		setOpen(true)
	}

	function askToSignIn() {
		rememberAfterSignIn({ action: 'shop', recipeId })
		setAuthOpen(true)
	}

	// Opens the sheet a visitor asked for before signing in, once the kitchen
	// is known: on the email path once the dialog's sign-in lands, on the
	// Google path when the page loads again.
	const finishShop = useEffectEvent(openSheet)

	useEffect(() => {
		if (shown && takeAfterSignIn({ action: 'shop', recipeId }))
			// It syncs with session storage and the session, both outside React.
			// oxlint-disable-next-line react/set-state-in-effect
			finishShop()
	}, [shown, recipeId])

	if (!shown && !asking) return null

	const label =
		state === 'add'
			? 'add to list'
			: state === 'missing'
				? `missing ${missing.length}`
				: state === 'listed'
					? `${listed.length} on your list`
					: 'ready'

	// Less to buy, down to none, which skips it; more, from none, puts it
	// back as it was. One just said to be out here goes home again instead:
	// none to buy of what you just ran out of is a slip, taken back.
	function step(row: Row, by: 1 | -1) {
		const line = row.line

		if (draft.none.has(line)) {
			if (by === 1)
				setDraft((now) => ({ ...now, none: withoutLines([line])(now.none) }))

			return
		}

		const said = withAmountSaid(amount(row))
		const next = stepShopping(said, by)

		if (next !== said)
			setDraft((now) => ({
				...now,
				amounts: { ...now.amounts, [line]: next },
			}))
		else if (by === -1)
			setDraft((now) =>
				now.outs.has(line)
					? { ...now, outs: withoutLines([line])(now.outs) }
					: { ...now, none: withLine(line)(now.none) },
			)
	}

	// A skipped staple said to be home after all: into the pantry group, and
	// on save into the pantry, so recipes stop asking for it.
	function homeAfterAll(row: Row) {
		setDraft((now) => ({
			...now,
			none: withoutLines([row.line])(now.none),
			homes: withLine(row.line)(now.homes),
		}))
		setPantryOpen(true)
	}

	const outs = shop.rows.filter(out)
	const homes = shop.rows.filter(homed)
	const skipped = toBuy.filter((row) => draft.none.has(row.line))

	// Everything at once: the list, the pantry, and what's skipped for this
	// recipe from now on. A skip never touches the pantry: what's kept is
	// said on the pantry's own page, so the meal's cilantro never lingers.
	// One undo takes all of it back.
	async function save() {
		const toBuyLines = new Set(toBuy.map((row) => row.line))
		const before = plan.data ?? null
		const newlySkipped = skipped.filter((row) => !draft.skipped.has(row.line))

		setOpen(false)

		const takeBacks = await Promise.all([
			taps.send(buying.map((row) => ({ ...row, adds: amount(row) }))),
			...outs.map(taps.out),
			...homes.map(taps.keep),
			taps.plan(
				[
					...[...skips].filter((line) => !toBuyLines.has(line)),
					...skipped.map((row) => row.line),
				],
				before,
			),
		])

		// A write that failed has said so; what did land can still be undone.
		const landed = takeBacks.flatMap((takeBack) => (takeBack ? [takeBack] : []))

		if (!landed.length) return

		const message = buying.length
			? `added ${count(buying.length, 'food', 'foods')} to your list`
			: homes.length === 1
				? `put ${homes[0]?.name ?? 'it'} in your pantry`
				: homes.length
					? `put ${homes.length} foods in your pantry`
					: newlySkipped.length === 1
						? `skipped ${newlySkipped[0]?.name ?? 'it'}`
						: newlySkipped.length
							? `skipped ${newlySkipped.length} foods`
							: undefined

		if (!message) return

		taps.said(message, landed)
	}

	const stay = () => {
		setLeaving(false)
		blocker.reset?.()
	}

	const leave = () => {
		setLeaving(false)
		setOpen(false)
		blocker.proceed?.()
	}

	return (
		<>
			{/* As tall as the heading's row, so the bar wrapping under it leaves
			    the heading level with the steps'. */}
			<span
				className={cn('relative inline-flex min-h-11 items-center', className)}
			>
				<button
					ref={pill}
					type="button"
					onClick={asking ? askToSignIn : openSheet}
					className={cn(
						'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold transition-transform active:scale-95',
						readinessLooks[state],
					)}
				>
					<ReadinessIcon state={state} />
					{label}
				</button>
				{hint ? (
					<span
						aria-hidden
						className="bg-foreground text-background before:bg-foreground absolute right-0 bottom-full z-10 mb-2 rounded-md px-2.5 py-1.5 text-xs font-bold whitespace-nowrap before:absolute before:right-5 before:-bottom-1 before:size-2 before:rotate-45"
					>
						tap to see what's missing
					</span>
				) : null}
				{asking ? (
					<AuthDialog
						open={authOpen}
						onOpenChange={setAuthOpen}
						redirect={pathname}
						// Signed in, the page loads again as the account sees it.
						onSuccess={() => void router.invalidate()}
					/>
				) : null}
				{open ? (
					<ItemSheet
						anchor={() => pill.current}
						title={label}
						wide
						// Changes not saved are asked about before they're dropped.
						onClose={() => (changed ? setLeaving(true) : setOpen(false))}
					>
						{/* One group, so a food slides from list to list. */}
						<LayoutGroup>
							{/* The sheet grows and shrinks from its foot on a phone, so all
						    of it moves as one, and a food slides within it. */}
							<motion.div
								layout="position"
								transition={{
									duration: reduceMotion ? 0 : 0.3,
									ease: 'easeInOut',
								}}
								className="flex flex-col gap-4"
							>
								<SheetHead>{label}</SheetHead>
								{toBuy.length ? (
									<ToBuy
										rows={toBuy}
										amount={amount}
										none={none}
										onStep={step}
										onHome={setConfirming}
									/>
								) : null}
								{/* The settled groups stack as one list of lines. */}
								<div className="flex flex-col">
									{listed.length ? (
										<OnTheList
											rows={listed}
											// Folded while the to-buy box shows, skipped foods
											// and all; open when it's all there is.
											folded={toBuy.length > 0}
										/>
									) : null}
									<PantryFoods
										rows={inPantry}
										open={pantryOpen}
										onOpenChange={setPantryOpen}
										// One just said to be home goes back to buy: a slip,
										// taken back.
										onOut={(row) =>
											setDraft((now) =>
												now.homes.has(row.line)
													? {
															...now,
															homes: withoutLines([row.line])(now.homes),
														}
													: { ...now, outs: withLine(row.line)(now.outs) },
											)
										}
									/>
								</div>
								{buying.length || changed ? (
									// A long list scrolls under the button, which stays in
									// reach. Its edges meet the sheet's, or the popover's on
									// a wide screen.
									<div className="bg-card sticky -bottom-8 -mx-5 -mb-8 px-5 pt-2 pb-8 md:-bottom-4 md:-mx-4 md:-mb-4 md:px-4 md:pb-4">
										<Button onClick={() => void save()} className="w-full">
											{buying.length ? (
												<>
													<ShoppingCartIcon weight="bold" aria-hidden />
													add {buying.length} to list
												</>
											) : (
												'save'
											)}
										</Button>
									</div>
								) : null}
							</motion.div>
						</LayoutGroup>
						{leaving || blocker.status === 'blocked' ? (
							<LeaveDialog onStay={stay} onLeave={leave} />
						) : null}
						{confirming ? (
							<PantryConfirm
								name={confirming.name}
								onConfirm={() => {
									homeAfterAll(confirming)
									setConfirming(undefined)
								}}
								onCancel={() => setConfirming(undefined)}
							/>
						) : null}
					</ItemSheet>
				) : null}
			</span>
			{/* A line of its own, under the heading and the pill. */}
			{ready ? (
				<ReadyBar
					ready={ready}
					kind="track"
					className="mt-1 mb-1.5 basis-full"
				/>
			) : null}
		</>
	)
}

// Add is the pill's alone, before the pantry knows anything.
type Readiness = 'add' | 'missing' | 'listed' | 'ready'

const readinessLooks: Record<Readiness, string> = {
	add: 'border-border border',
	missing: 'bg-kitchen-yolk',
	listed: 'border-foreground/40 border border-dashed',
	ready: 'border-border border',
}

function ReadinessIcon({ state }: { state: Readiness }) {
	if (state === 'ready')
		return (
			<CheckIcon
				size={14}
				weight="bold"
				aria-hidden
				className="text-kitchen-basil"
			/>
		)

	// The groceries tab's cart: it's waiting there.
	if (state === 'listed')
		return <ShoppingCartIcon size={14} weight="bold" aria-hidden />

	// What the sheet it opens does: adds them.
	return <PlusIcon size={14} weight="bold" aria-hidden />
}

// Where a recipe stands, from what's home and on the list and what's
// skipped for it, as its pill says it.
export function readinessOf(
	rows: RecipeShop['rows'],
	skips: ReadonlySet<string>,
) {
	const listed = rows.filter((row) => row.onList)

	const buying = rows.filter(
		(row) => !row.onList && !row.home && !skips.has(row.line),
	)

	if (buying.length)
		return { state: 'missing' as const, label: `missing ${buying.length}` }

	if (listed.length)
		return { state: 'listed' as const, label: `${listed.length} on your list` }

	return { state: 'ready' as const, label: 'ready' }
}

// The pill's look, to be read rather than pressed: on home's recipes in progress.
export function ReadinessMark({
	state,
	label,
}: {
	state: Readiness
	label: string
}) {
	return (
		<span
			className={cn(
				'inline-flex min-h-7 w-fit items-center gap-1.5 rounded-md px-2 text-xs font-bold',
				readinessLooks[state],
			)}
		>
			<ReadinessIcon state={state} />
			{label}
		</span>
	)
}

// A faint sign before a food's name that it's home. One going on the list
// has its stepper instead, and one on it its amount.
const marks = {
	home: { Icon: CheckIcon, tint: 'text-kitchen-basil' },
} as const

// A food and what can be done with it. On one line, a long name ends in
// "…" rather than wrapping, so a note under it fits the row's height and
// coming or going never moves the sheet.
function FoodRow({
	row,
	mark,
	label,
	oneLine = false,
	note,
	quiet = false,
	struck = false,
	children,
}: {
	row: Row
	mark?: keyof typeof marks
	label?: React.ReactNode
	oneLine?: boolean
	// Only a row on one line has room for one.
	note?: React.ReactNode
	quiet?: boolean
	struck?: boolean
	children?: React.ReactNode
}) {
	const reduceMotion = useReducedMotion()
	const look = ingredientItemLook(row.line)
	const sign = mark ? marks[mark] : undefined

	return (
		<motion.li
			// A food said to be out slides up from the pantry into what's to buy,
			// and back down when that's taken back, as the grocery list's rows
			// do into the cart.
			layoutId={`food-${row.line}`}
			layout="position"
			// Its look changes as it moves ("i'm out" becomes a stepper), so the
			// new one leads rather than fading in over the old.
			layoutCrossfade={false}
			// It arrives whole, from where it was; it leaves by fading.
			initial={false}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
			className="flex min-h-13 items-center gap-3 py-1"
		>
			<span aria-hidden className="grid size-6 shrink-0 place-items-center">
				{look ? <PantrySprite look={look} className="size-6" /> : null}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				{/* The sign stays beside the first line of a name that wraps. */}
				<span
					className={cn(
						'flex gap-1.5 text-base',
						(quiet || struck) && 'text-muted-foreground',
					)}
				>
					{sign ? (
						<sign.Icon
							size={12}
							weight="bold"
							aria-hidden
							className={cn('mt-1.5 shrink-0', sign.tint)}
						/>
					) : null}
					<span
						className={cn(
							oneLine && 'min-w-0 truncate',
							struck && 'decoration-foreground/40 line-through',
						)}
					>
						{label ?? row.name}
					</span>
				</span>
				{/* Snug, so a row with a note is no taller than one without. */}
				{oneLine && note ? (
					<span className="text-muted-foreground text-sm leading-4 font-semibold">
						{note}
					</span>
				) : null}
			</span>
			{children}
		</motion.li>
	)
}

// A sheet's heading, with a way out beside it: a tap outside closes it too,
// but that isn't plain to see.
export function SheetHead({ children }: { children: React.ReactNode }) {
	return (
		<div className="-my-1 flex items-center justify-between gap-2">
			<h2 className="text-lg font-bold">{children}</h2>
			<ItemSheetDone
				className={cn(
					buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
					'-mr-2',
				)}
			>
				<XIcon weight="bold" aria-hidden />
				<span className="sr-only">close</span>
			</ItemSheetDone>
		</div>
	)
}

// What's to buy, as the list lines it'll be: each food with how much, in a
// dashed box, as what isn't real yet is. Down to none, it's skipped.
function ToBuy({
	rows,
	amount,
	none,
	onStep,
	onHome,
}: {
	rows: readonly Row[]
	amount: (row: Row) => string
	none: (row: Row) => boolean
	onStep: (row: Row, by: 1 | -1) => void
	onHome: (row: Row) => void
}) {
	return (
		<ul className="divide-border border-foreground/40 divide-y rounded-xl border border-dashed px-3">
			<AnimatePresence initial={false}>
				{rows.map((row) => {
					// How far it is from what the recipe asks, in what's bought.
					const apart = none(row)
						? undefined
						: amountApart(withAmountSaid(amount(row)), withAmountSaid(row.adds))

					return (
						<FoodRow
							key={row.line}
							row={row}
							struck={none(row)}
							label={<ListLine row={row} />}
							oneLine
							// A staple not bought is most likely home: one tap says so.
							// The strike and the 0 already say it's skipped.
							note={
								none(row) && row.staple ? (
									<button
										type="button"
										onClick={() => onHome(row)}
										className="decoration-kitchen-eggplant text-foreground -my-2 block py-2 text-left underline underline-offset-4"
									>
										already have it
									</button>
								) : undefined
							}
						>
							<span className="flex shrink-0 flex-col items-center gap-0.5">
								<BuyStepper
									name={row.name}
									text={amount(row)}
									none={none(row)}
									apart={apart}
									onStep={(by) => onStep(row, by)}
								/>
								{/* Under the amount it's about: "1 extra", "½ lb short".
								    Its room is kept when there's none, so it coming or
								    going moves nothing. */}
								<span className="text-muted-foreground min-h-3 text-xs leading-3 font-semibold">
									{apart
										? `${apart.by} ${apart.more ? 'extra' : 'short'}`
										: null}
								</span>
							</span>
						</FoodRow>
					)
				})}
			</AnimatePresence>
		</ul>
	)
}

// A food to buy, as the list line adding it makes: the food and the brand
// the list or the pantry keeps for it. One on the list already for another
// recipe isn't said: adding makes the one line more.
function ListLine({ row }: { row: Row }) {
	const brand = row.elsewhere?.brand ?? row.item?.brand ?? null

	return <WithBrand name={row.name} brand={brand} />
}

// How much of a food to buy, on a yolk pill like the list's: less, the
// amount, more. Below the least is none: skipped. Away from what the recipe
// asks, its edge says which way: basil for more, tomato for short.
function BuyStepper({
	name,
	text,
	none,
	apart,
	onStep,
}: {
	name: string
	text: string
	none: boolean
	apart: { more: boolean } | undefined
	onStep: (by: 1 | -1) => void
}) {
	const said = withAmountSaid(text)
	const least = stepShopping(said, -1) === said

	return (
		<span
			// Bordered either way, so neither a skip nor a change moves it.
			className={cn(
				'flex shrink-0 items-center rounded-md border',
				none
					? 'border-border'
					: cn(
							'bg-kitchen-yolk/40',
							!apart && 'border-transparent',
							apart?.more && 'border-kitchen-basil',
							apart && !apart.more && 'border-kitchen-tomato',
						),
			)}
		>
			<button
				type="button"
				aria-label={least ? `skip ${name}` : `less ${name}`}
				disabled={none}
				onClick={() => onStep(-1)}
				className="grid size-9 place-items-center rounded-md disabled:opacity-50"
			>
				<MinusIcon size={15} weight="bold" aria-hidden />
			</button>
			<span
				aria-live="polite"
				className="min-w-16 text-center text-sm font-bold tabular-nums"
			>
				{none ? '0' : amountShown(text)}
			</span>
			<button
				type="button"
				aria-label={`more ${name}`}
				onClick={() => onStep(1)}
				className="grid size-9 place-items-center rounded-md"
			>
				<PlusIcon size={15} weight="bold" aria-hidden />
			</button>
		</span>
	)
}

// A group of the recipe's foods folded under one line, with their sprites
// beside it, so what's settled doesn't crowd what's left to do. Open, it
// shows each food.
function Fold({
	label,
	rows,
	open,
	onOpenChange,
	children,
}: {
	label: string
	rows: readonly Row[]
	open: boolean
	onOpenChange: (open: boolean) => void
	children: React.ReactNode
}) {
	const reduceMotion = useReducedMotion()
	const Caret = open ? CaretDownIcon : CaretRightIcon

	return (
		<motion.section
			layout="position"
			transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
			className="border-border border-t"
		>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => onOpenChange(!open)}
				className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-bold"
			>
				<Caret
					size={14}
					weight="bold"
					aria-hidden
					className="text-muted-foreground"
				/>
				<span className="flex-1">{label}</span>
				{open ? null : (
					<span aria-hidden className="flex">
						{rows.slice(0, 6).map((row) => {
							const look = ingredientItemLook(row.line)

							return look ? (
								<PantrySprite
									key={row.line}
									look={look}
									className="-ml-1.5 size-5 first:ml-0"
								/>
							) : null
						})}
					</span>
				)}
			</button>
			<AnimatePresence initial={false}>
				{open ? (
					<motion.ul
						key="rows"
						// It clips only while it opens or closes, so a food sliding
						// back in is never cut off.
						initial={
							reduceMotion
								? false
								: { height: 0, opacity: 0, overflow: 'hidden' }
						}
						animate={{
							height: 'auto',
							opacity: 1,
							transitionEnd: { overflow: 'visible' },
						}}
						exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
						transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
						className="divide-border divide-y"
					>
						{children}
					</motion.ul>
				) : null}
			</AnimatePresence>
		</motion.section>
	)
}

// What's on the list for this recipe already, until it's put away: folded
// while there's something left to buy, open when it's all there is.
function OnTheList({
	rows,
	folded,
}: {
	rows: readonly Row[]
	folded: boolean
}) {
	const [open, setOpen] = useState(false)

	const foods = rows.map((row) => (
		<FoodRow key={row.line} row={row}>
			{/* How much, where the to-buy box has its stepper. The heading
			    already says it's on the list. */}
			<span className="text-muted-foreground shrink-0 text-sm font-bold tabular-nums">
				{amountShown(row.onList?.text ?? row.adds)}
			</span>
		</FoodRow>
	))

	const seeList = (
		<Link
			to="/groceries"
			className="decoration-kitchen-eggplant text-sm font-bold underline underline-offset-4"
		>
			see your list
		</Link>
	)

	if (folded)
		return (
			<Fold
				label={`${rows.length} on your list`}
				rows={rows}
				open={open}
				onOpenChange={setOpen}
			>
				{foods}
				<li className="pt-3 pb-4">{seeList}</li>
			</Fold>
		)

	return (
		<section className="flex flex-col gap-3 pb-4">
			<ul className="divide-border divide-y">{foods}</ul>
			<span>{seeList}</span>
		</section>
	)
}

// The recipe's foods the pantry says are home, folded under one line. Open,
// each can be said to be out, which moves it up to buy, and the pantry's
// own page is a tap away for staples kept that it doesn't know yet.
function PantryFoods({
	rows,
	open,
	onOpenChange,
	onOut,
}: {
	rows: readonly Row[]
	open: boolean
	onOpenChange: (open: boolean) => void
	onOut: (row: Row) => void
}) {
	if (!rows.length) return null

	return (
		<Fold
			label={`${rows.length} in your pantry`}
			rows={rows}
			open={open}
			onOpenChange={onOpenChange}
		>
			<AnimatePresence initial={false}>
				{rows.map((row) => (
					<FoodRow key={row.line} row={row} mark="home" quiet>
						<button
							type="button"
							aria-label={`${row.name} is out`}
							onClick={() => onOut(row)}
							className={buttonVariants({ variant: 'outline', size: 'sm' })}
						>
							i'm out
						</button>
					</FoodRow>
				))}
			</AnimatePresence>
			<li className="pt-3">
				<Link
					to="/pantry/staples"
					className="decoration-kitchen-eggplant text-sm font-bold underline underline-offset-4"
				>
					add staples
				</Link>
			</li>
		</Fold>
	)
}

// A staple said to be home, asked about first: it's rare, and it changes
// what every recipe counts as home. Saying what undoes it makes it less of
// a leap.
function PantryConfirm({
	name,
	onConfirm,
	onCancel,
}: {
	name: string
	onConfirm: () => void
	onCancel: () => void
}) {
	return (
		<Dialog open onOpenChange={(next) => !next && onCancel()}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>put {name} in your pantry?</DialogTitle>
					<DialogDescription>
						recipes will count it as home until you say you're out.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						cancel
					</Button>
					<Button onClick={onConfirm}>add to pantry</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// Closed with changes not saved: asked before they're dropped. Staying is
// the safe answer, so it leads.
function LeaveDialog({
	onStay,
	onLeave,
}: {
	onStay: () => void
	onLeave: () => void
}) {
	return (
		<Dialog open onOpenChange={(next) => !next && onStay()}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>discard your changes?</DialogTitle>
					<DialogDescription>
						nothing goes on your list, and your pantry stays as it was.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onLeave}>
						discard
					</Button>
					<Button onClick={onStay}>keep editing</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
