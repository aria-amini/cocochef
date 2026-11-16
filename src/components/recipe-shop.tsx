import { Menu } from '@base-ui/react/menu'
import {
	CaretDownIcon,
	CheckIcon,
	CookingPotIcon,
	MinusIcon,
	PlusIcon,
	ShoppingCartIcon,
	TrashIcon,
	type Icon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { groceryCountKey } from '@/components/grocery-badge'
import { PantrySprite } from '@/components/pantry-sprite'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { usePantry, useWaitingGroceries } from '@/components/use-pantry'
import { authClient } from '@/lib/auth/client'
import { buyingAmount, stepShopping } from '@/lib/groceries/amounts'
import { groceryLine, shoppingLine } from '@/lib/groceries/list'
import { sameItem } from '@/lib/groceries/model'
import {
	addGroceries,
	deleteGrocery,
	leaveGrocery,
	renameGrocery,
} from '@/lib/groceries/server'
import { findInPantry, foodOf, shelfLife } from '@/lib/pantry/foods'
import { haveFood, setPantryItemLevel } from '@/lib/pantry/server'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { hadItIn, lineStatus } from '@/lib/pantry/status'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import {
	amountOf,
	ingredientHeading,
	ingredientSubject,
	withAmount,
} from '@/lib/recipes/ingredient-line'
import { cn } from '@/lib/utils/ui'

// A recipe's ingredients are read two ways, one after the other: shop for
// them, then cook with them.
export type IngredientsStep = 'shop' | 'cook'

// The recipe's food, without its section names, and each food once, as the
// list would take it: salt in the dough and the filling is one salt.
function foodsOf(lines: string[]) {
	const seen = new Set<string>()

	return lines.filter((line) => {
		if (!line.trim() || ingredientHeading(line) !== undefined) return false

		const key = sameItem(shoppingLine(line))

		if (seen.has(key)) return false
		seen.add(key)

		return true
	})
}

// What the kitchen and the list say of a recipe's food: each food, where it
// stands, and how many are still to buy. Signed out, nothing is known.
export function useRecipeShop(
	recipeId: string,
	lines: string[],
	enabled = true,
) {
	const session = authClient.useSession()
	const signedIn = !!session.data?.user
	const pantry = usePantry(signedIn && enabled)
	const waiting = useWaitingGroceries(signedIn && enabled)
	const known = signedIn && pantry.isSuccess && waiting.isSuccess
	const kept = pantry.data ?? []
	const listed = waiting.data ?? []

	const waitingTexts = listed.map((item) => item.text)

	const items = listed.map((item) => ({
		...item,
		name: ingredientSubject(groceryLine(item.text)),
	}))

	const rows = foodsOf(lines).flatMap((line) => {
		const status = lineStatus(line, kept, waitingTexts)

		if (!status) return []

		// On the list for this recipe, it's in this recipe's cart. On it for
		// another (or typed in by hand), it's still to get here: another
		// recipe's can of tomatoes isn't this one's.
		const match = findInPantry(line, items)
		const forThis = match?.recipes.some((recipe) => recipe.id === recipeId)
		const onList = forThis ? match : undefined
		const elsewhere = forThis ? undefined : match
		const have = findInPantry(line, kept)
		const home = have !== undefined && have.level !== 'out' && !have.stale
		const bought = buyingAmount(line)

		return [
			{
				line,
				status,
				name: bought.name,
				// What adding it puts on the list: the food as a shop sells it,
				// in the amount the recipe needs ("2 lb ground beef", "1 jar
				// cumin").
				adds: `${bought.amount} ${bought.name}`,
				onList,
				elsewhere,
				home,
				// The pantry item that says it's home, to say otherwise.
				keptId: home ? have.id : undefined,
				// Whether it keeps: milk and spinach go off within weeks; flour,
				// cans, onions and garlic keep longer.
				kept: keeps(line),
			},
		]
	})

	const toBuy = rows.filter((row) => !row.onList && !row.home).length
	const inCart = rows.filter((row) => row.onList).length
	// Shopping is done once everything is home, not when it's in the cart.
	const done = known && toBuy === 0 && inCart === 0

	// Whether who's reading, and what their kitchen and list hold, are read
	// yet: until then, which step to open on can't be said.
	const settled = !session.isPending && (!signedIn || known || !enabled)

	return { signedIn, known, settled, rows, toBuy, inCart, done }
}

export type RecipeShop = ReturnType<typeof useRecipeShop>

// Where one of a recipe's lines stands, said while cooking: still to buy,
// on the list, or nothing to say because it's home (or nothing is known).
export function shopStatusOf(
	shop: RecipeShop,
	line: string,
): 'buy' | 'listed' | undefined {
	if (!shop.known) return undefined

	const key = sameItem(shoppingLine(line))

	const row = shop.rows.find(
		(each) => sameItem(shoppingLine(each.line)) === key,
	)

	if (!row || row.home) return undefined

	return row.onList || row.elsewhere ? 'listed' : 'buy'
}

// Food counts as perishable when it keeps this many days or fewer.
const perishableDays = 21

// Whether a food keeps past that. One the catalog doesn't know and can't
// shelve ("short ribs") is more likely bought for the meal, so it doesn't.
function keeps(line: string) {
	const food = foodOf(line)
	const category = food?.category ?? ingredientCategory(line)

	if (!food && category === 'other') return false

	return (
		shelfLife(food?.name ?? ingredientSubject(groceryLine(line)), category) >
		perishableDays
	)
}

// A list line with its amount said: one typed with none ("flour") is what a
// shop sells one of ("1 bag flour"), so its stepper has a number to step.
export function withAmountSaid(text: string) {
	if (amountOf(text)) return text

	const bought = buyingAmount(text)

	return `${bought.amount} ${bought.name}`
}

// How much a list line says to buy, as its stepper shows it: "2 lb", "3
// bags", "4".
export function amountShown(text: string) {
	const amount = amountOf(withAmountSaid(text))

	return amount ? withAmount(amount.quantity, amount.unit, '') : '1'
}

// A line with one share taken off: the amounts subtracted when they're in
// the same unit and something is left, else the line as it was.
function less(onList: string, share: string) {
	const a = amountOf(withAmountSaid(onList))
	const b = amountOf(withAmountSaid(share))

	if (a && b && a.unit === b.unit && a.quantity > b.quantity)
		return withAmount(a.quantity - b.quantity, a.unit, a.rest)

	return onList
}

// Two amounts of one food as one line: added up when they're in the same
// unit ("1 can" and "1 can" is "2 cans"), else the first a step bigger.
function together(onList: string, more: string) {
	const a = amountOf(withAmountSaid(onList))
	const b = amountOf(withAmountSaid(more))

	if (a && b && a.unit === b.unit)
		return withAmount(a.quantity + b.quantity, a.unit, a.rest)

	return stepShopping(withAmountSaid(onList), 1)
}

type Row = RecipeShop['rows'][number]

// Which step the ingredients show: the one picked, or else shopping, unless
// the kitchen has it all, so a recipe opened mid-meal opens on cooking.
// Signed out, it opens on cooking, and shopping asks to sign up first.
export function useIngredientsStep(shop: RecipeShop) {
	const client = useQueryClient()
	const [picked, setPicked] = useState<IngredientsStep>()
	// The step it opens on, said once what's home is read and kept after, so
	// the page doesn't open on one step and jump to the other, nor jump away
	// when the last food comes home.
	const [opened, setOpened] = useState<IngredientsStep>()

	if (!opened && shop.settled)
		setOpened(!shop.signedIn || shop.done ? 'cook' : 'shop')
	const [authOpen, setAuthOpen] = useState(false)

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const step = picked ?? opened

	const choose = (next: IngredientsStep) =>
		next === 'shop' && !shop.signedIn ? setAuthOpen(true) : setPicked(next)

	const auth = (
		<AuthDialog
			open={authOpen}
			onOpenChange={setAuthOpen}
			redirect={pathname}
			onSuccess={() => {
				void client.invalidateQueries({ queryKey: ['pantry'] })
				void client.invalidateQueries({ queryKey: ['groceries'] })
				setPicked('shop')
			}}
		/>
	)

	return { step, choose, auth }
}

// A step's mark; shopping done, its cart wears a basil tick.
function StepMark({ mark: Mark, done }: { mark: Icon; done: boolean }) {
	return (
		<span className="relative grid shrink-0 place-items-center">
			<Mark size={16} weight="bold" aria-hidden />
			{done ? (
				<span
					aria-hidden
					className="bg-kitchen-basil ring-background absolute -top-1.5 -right-1.5 grid size-3 place-items-center rounded-full ring-2"
				>
					<CheckIcon size={8} weight="bold" className="text-background" />
				</span>
			) : null}
		</span>
	)
}

// Which step the ingredients are read for, as one quiet switch by their
// heading: shopping or cooking, the other a tap away in its menu. Shopping
// done, its cart wears a tick.
export function IngredientsSteps({
	step,
	onStep,
	shop,
}: {
	step: IngredientsStep
	onStep: (step: IngredientsStep) => void
	shop: RecipeShop
}) {
	const set = shop.done

	const steps = [
		{ id: 'shop', label: 'shopping', mark: ShoppingCartIcon },
		{ id: 'cook', label: 'cooking', mark: CookingPotIcon },
	] as const

	const current = steps.find((each) => each.id === step) ?? steps[0]
	const Mark = current.mark

	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={`ingredients for ${current.label}${set && step === 'shop' ? ', all set' : ''}`}
				className="hover:bg-muted/60 data-popup-open:bg-muted/60 -mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-bold transition-colors"
			>
				<StepMark mark={Mark} done={set && step === 'shop'} />
				{current.label}
				<CaretDownIcon
					size={12}
					weight="bold"
					aria-hidden
					className="text-muted-foreground"
				/>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner className="z-50" align="end" sideOffset={6}>
					<Menu.Popup className="floating bg-background flex w-52 flex-col overflow-hidden py-1 outline-none">
						{steps.map(({ id, label, mark: ItemMark }) => (
							<Menu.Item
								key={id}
								onClick={() => onStep(id)}
								className={cn(
									'data-highlighted:bg-kitchen-yolk/40 flex min-h-11 w-full cursor-default items-center gap-2.5 px-3 text-sm font-semibold outline-none select-none',
									// The step showing is the picked one, yolk as picks are.
									id === step && 'bg-kitchen-yolk/25',
								)}
							>
								<StepMark mark={ItemMark} done={id === 'shop' && set} />
								<span className="flex-1">
									{label}
									{id === step ? (
										<span className="sr-only">, showing</span>
									) : null}
								</span>
								{id === 'shop' && set ? (
									<span className="text-muted-foreground text-xs">all set</span>
								) : null}
							</Menu.Item>
						))}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	)
}

// The recipe read for the shop: its perishables, bought for the meal, then
// what keeps and is only topped up, each food once with what to do about it. Missing food offers
// "add to cart", which puts the amount the recipe needs on the list and
// turns into a stepper for it; at its least, the stepper takes it out.
export function ShopList({
	recipeId,
	shop,
}: {
	recipeId: string
	shop: RecipeShop
}) {
	const client = useQueryClient()
	const reduceMotion = useReducedMotion()

	// What a tap changed, shown at once while the list catches up.
	const [adding, setAdding] = useState<ReadonlyMap<string, string>>(
		() => new Map(),
	)

	const [texts, setTexts] = useState<ReadonlyMap<string, string>>(
		() => new Map(),
	)

	const [taken, setTaken] = useState<ReadonlySet<string>>(() => new Set())
	// Food said not to be home after all, and the one being asked about.
	const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set())
	const [had, setHad] = useState<ReadonlySet<string>>(() => new Set())
	const [asked, setAsked] = useState<Row>()

	// Each item's saves go one after another, so a quick run of taps lands in
	// the order it was tapped.
	const saves = useRef(new Map<string, Promise<unknown>>())

	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: ['groceries'] }),
			client.invalidateQueries({ queryKey: groceryCountKey }),
		])

	const without = (key: string) => (now: ReadonlySet<string>) => {
		const next = new Set(now)

		next.delete(key)

		return next
	}

	const withKey = (key: string) => (now: ReadonlySet<string>) =>
		new Set(now).add(key)

	async function add(row: Row, text = row.adds) {
		// Already on the list for another recipe: one line, with this recipe's
		// amount added to it, and this recipe linked.
		const shared = row.elsewhere
		const shown = shared ? together(shared.text, text) : text

		setAdding((now) => new Map(now).set(row.line, shown))
		setTaken(without(row.line))

		try {
			// A shared line is named as it is, so the list links this recipe to
			// it rather than adding a second line for the same food.
			await addGroceries({
				data: [
					{
						text: (shared ? shared.text : text).slice(0, 200),
						recipeIds: [recipeId],
					},
				],
			})

			if (shared)
				await renameGrocery({
					data: { id: shared.id, text: shown.slice(0, 200) },
				})

			toast(`added ${row.name} to your cart`)

			await refresh()
		} catch {
			toast.error(`couldn't add ${row.name} — try again`)
		} finally {
			setAdding((now) => {
				const next = new Map(now)

				next.delete(row.line)

				return next
			})
		}
	}

	function step(id: string, text: string, by: 1 | -1) {
		const next = stepShopping(withAmountSaid(text), by)

		setTexts((now) => new Map(now).set(id, next))

		const saved = (saves.current.get(id) ?? Promise.resolve())
			.catch(() => undefined)
			.then(() => renameGrocery({ data: { id, text: next } }))

		saves.current.set(id, saved)
		saved.then(refresh).catch(() => {
			toast.error("couldn't change that — try again")
			setTexts((now) => {
				const back = new Map(now)

				back.delete(id)

				return back
			})
		})
	}

	// Out of the cart at once, back with what's still to get.
	async function takeOff(row: Row, id: string) {
		setTaken(withKey(row.line))

		// A line other recipes want too keeps their share; only this
		// recipe's comes off, and it's no longer marked for it.
		const others = (row.onList?.recipes ?? []).filter(
			(recipe) => recipe.id !== recipeId,
		)

		try {
			await (saves.current.get(id) ?? Promise.resolve()).catch(() => undefined)

			if (others.length && row.onList)
				await leaveGrocery({
					data: {
						id,
						recipeId,
						text: less(texts.get(id) ?? row.onList.text, row.adds).slice(
							0,
							200,
						),
					},
				})
			else await deleteGrocery({ data: { id } })

			await refresh()
		} catch {
			toast.error(`couldn't take ${row.name} out — try again`)
			setTaken(without(row.line))
		}
	}

	// Home after all: the pantry gets it, topped up or new.
	async function markHave(row: Row) {
		setGone(without(row.line))
		setHad(withKey(row.line))

		try {
			await haveFood({ data: { text: shoppingLine(row.line).slice(0, 200) } })
			await client.invalidateQueries({ queryKey: ['pantry'] })
		} catch {
			toast.error(`couldn't mark ${row.name} as home — try again`)
			setHad(without(row.line))
		}
	}

	// More wanted of something home: the pantry says to get more (some may
	// be left), and the cart gets the amount asked for.
	async function getMore(row: Row, text: string) {
		setAsked(undefined)
		setHad(without(row.line))
		setGone(withKey(row.line))
		void add(row, text)

		if (!row.keptId) return

		try {
			await setPantryItemLevel({
				data: { id: row.keptId, level: 'low' },
			})
			await client.invalidateQueries({ queryKey: ['pantry'] })
		} catch {
			toast.error(`couldn't change ${row.name} — try again`)
			setGone(without(row.line))
		}
	}

	// Not home, and not wanted: the pantry says it's out, and the food goes
	// back with what's still to get, off the list.
	async function markOut(row: Row) {
		setAsked(undefined)
		setHad(without(row.line))
		setGone(withKey(row.line))

		if (!row.keptId) return

		try {
			await setPantryItemLevel({
				data: { id: row.keptId, level: 'out' },
			})
			await client.invalidateQueries({ queryKey: ['pantry'] })
		} catch {
			toast.error(`couldn't change ${row.name} — try again`)
			setGone(without(row.line))
		}
	}

	// Three places a food can be: in the cart (on the list), still to get,
	// or already home. What a tap just did counts at once.
	const inCart = (row: Row) =>
		(!!row.onList && !taken.has(row.line)) || adding.has(row.line)

	const isHome = (row: Row) =>
		(row.home || had.has(row.line)) && !gone.has(row.line)

	const atHome = (row: Row) => !inCart(row) && isHome(row)

	const home = shop.rows.filter(atHome)
	const missing = shop.rows.filter((row) => !atHome(row))

	// What's still to get, in one list, put in the cart or not: a food
	// added stays in its row, its plus turned to how much. Perishables,
	// bought for the meal, lead, then what keeps and is only topped up. The
	// split is the order, not a heading.
	const toGet = [
		...missing.filter((row) => !row.kept),
		...missing.filter((row) => row.kept),
	]

	const [homeOpen, setHomeOpen] = useState(true)

	const pop = reduceMotion
		? { initial: false as const, transition: { duration: 0 } }
		: {
				initial: { opacity: 0, scale: 0.9 },
				animate: { opacity: 1, scale: 1 },
				transition: { duration: 0.18 },
			}

	const control = (row: Row) => {
		const listedId = taken.has(row.line) ? undefined : row.onList?.id
		const pending = adding.get(row.line)

		const text = listedId ? (texts.get(listedId) ?? row.onList?.text) : pending

		if (text !== undefined)
			return (
				<motion.span key="stepper" {...pop} className="shrink-0">
					<CartStepper
						name={row.name}
						text={text}
						disabled={!listedId}
						onStep={(by) => listedId && step(listedId, text, by)}
						onTakeOff={() => listedId && void takeOff(row, listedId)}
					/>
				</motion.span>
			)

		if (isHome(row))
			return (
				<motion.button
					key="home"
					{...pop}
					type="button"
					aria-label={`${row.name} is home`}
					onClick={() => setAsked(row)}
					className="bg-kitchen-basil/20 hover:bg-kitchen-basil/30 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-colors"
				>
					<CheckIcon size={12} weight="bold" aria-hidden />
					have
				</motion.button>
			)

		// Still to get: say it's home, or put it in the cart.
		return (
			<motion.span
				key="get"
				{...pop}
				className="flex shrink-0 items-center gap-1.5"
			>
				<button
					type="button"
					aria-label={`you have ${row.name}`}
					onClick={() => void markHave(row)}
					className="border-foreground/35 text-muted-foreground hover:text-foreground hover:border-foreground/60 inline-flex min-h-9 items-center rounded-full border border-dashed px-3 text-sm font-bold transition-colors"
				>
					have
				</button>
				<button
					type="button"
					aria-label={`add ${row.name} to your cart`}
					onClick={() => void add(row)}
					className="border-input hover:bg-muted/60 inline-flex min-h-9 items-center gap-1 rounded-full border pr-3.5 pl-2.5 text-sm font-bold whitespace-nowrap transition-colors"
				>
					<PlusIcon size={14} weight="bold" aria-hidden />
					add to cart
				</button>
			</motion.span>
		)
	}

	// A quiet word the control can't say: on the list for another recipe,
	// or not seen in a while.
	const noteOf = (row: Row) =>
		row.onList
			? undefined
			: row.elsewhere
				? `${amountShown(row.elsewhere.text)} on your list${
						row.elsewhere.recipes.length
							? ` for ${row.elsewhere.recipes.map((recipe) => recipe.title).join(', ')}`
							: ''
					}`
				: row.status.kind === 'stale'
					? hadItIn(row.status.since)
					: undefined

	const item = (row: Row) => {
		const look = ingredientItemLook(row.line)
		const faded = atHome(row)
		const note = noteOf(row)

		return (
			<li key={row.line} className="flex min-h-13 items-center gap-3 py-1">
				<span
					aria-hidden
					className={cn(
						'grid size-6 shrink-0 place-items-center',
						faded && 'opacity-50',
					)}
				>
					{look ? <PantrySprite look={look} className="size-6" /> : null}
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className={cn('text-base', faded && 'text-muted-foreground')}>
						{row.name}
					</span>
					{note ? (
						<span className="text-muted-foreground text-xs font-semibold">
							{note}
						</span>
					) : null}
				</span>
				<AnimatePresence initial={false} mode="popLayout">
					{control(row)}
				</AnimatePresence>
			</li>
		)
	}

	// Until the kitchen and the list are read, rows in their place, so the
	// step never shows everything as missing first.
	if (!shop.known)
		return (
			<div aria-busy className="flex flex-col gap-2 pt-3">
				{shop.rows.slice(0, 6).map((row) => (
					<Skeleton key={row.line} kind="line" className="h-11 w-full" />
				))}
			</div>
		)

	return (
		<div className="flex flex-col gap-1">
			{toGet.length ? (
				<section aria-labelledby="to-buy" className="pt-1">
					{/* Named as what's had below it is: what this recipe sends you
					    to the shop for. */}
					<h3
						id="to-buy"
						className="text-muted-foreground flex min-h-11 items-center text-sm font-bold"
					>
						to buy
					</h3>
					<ul className="divide-border divide-y">{toGet.map(item)}</ul>
				</section>
			) : null}
			{home.length ? (
				<section aria-label="already have">
					<button
						type="button"
						aria-expanded={homeOpen}
						onClick={() => setHomeOpen((now) => !now)}
						className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 text-sm font-bold transition-colors"
					>
						already have
						<CaretDownIcon
							size={12}
							weight="bold"
							aria-hidden
							className={cn('transition-transform', homeOpen && 'rotate-180')}
						/>
					</button>
					{homeOpen ? (
						<ul className="divide-border divide-y">{home.map(item)}</ul>
					) : null}
				</section>
			) : null}
			<Dialog
				open={asked !== undefined}
				onOpenChange={(open) => !open && setAsked(undefined)}
			>
				<DialogContent>
					{asked ? (
						<MoreOf
							key={asked.line}
							name={asked.name}
							adds={asked.adds}
							onAdd={(text) => void getMore(asked, text)}
							onOut={() => void markOut(asked)}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	)
}

// How much more of something home to buy, starting at what the recipe needs:
// some may be left, so less is a tap away.
export function MoreOf({
	name,
	adds,
	onAdd,
	onOut,
}: {
	name: string
	// The line it would go on the list as; without an amount, one to buy.
	adds: string
	onAdd: (text: string) => void
	// Not home and not buying it; left out where that isn't asked.
	onOut?: () => void
}) {
	const [text, setText] = useState(() => withAmountSaid(adds))
	const least = stepShopping(text, -1) === text

	return (
		<>
			<DialogTitle>need more {name}?</DialogTitle>
			<div className="border-input flex min-h-12 items-center justify-between rounded-xl border px-1">
				<button
					type="button"
					aria-label={`less ${name}`}
					disabled={least}
					onClick={() => setText((now) => stepShopping(now, -1))}
					className="grid size-11 place-items-center rounded-full disabled:opacity-30"
				>
					<MinusIcon size={16} weight="bold" aria-hidden />
				</button>
				<span aria-live="polite" className="text-lg font-bold tabular-nums">
					{amountShown(text)}
				</span>
				<button
					type="button"
					aria-label={`more ${name}`}
					onClick={() => setText((now) => stepShopping(now, 1))}
					className="grid size-11 place-items-center rounded-full"
				>
					<PlusIcon size={16} weight="bold" aria-hidden />
				</button>
			</div>
			<DialogFooter>
				<Button onClick={() => onAdd(text)}>
					<PlusIcon weight="bold" aria-hidden />
					add to cart
				</Button>
			</DialogFooter>
			{/* The other case: not home, and not buying it. */}
			{onOut ? (
				<p className="border-border text-muted-foreground border-t pt-3 text-sm font-semibold">
					not buying it?{' '}
					<button
						type="button"
						onClick={onOut}
						className="text-foreground decoration-kitchen-eggplant font-bold underline underline-offset-4"
					>
						mark as out
					</button>
				</p>
			) : null}
		</>
	)
}

// How much of a food is in the cart, on a yolk pill to change in store
// steps: less, the amount, more; at the least, a bin takes it out.
export function CartStepper({
	name,
	text,
	disabled = false,
	onStep,
	onTakeOff,
}: {
	name: string
	text: string
	disabled?: boolean
	onStep: (by: 1 | -1) => void
	onTakeOff: () => void
}) {
	const said = withAmountSaid(text)
	const least = stepShopping(said, -1) === said

	return (
		<span className="bg-kitchen-yolk/40 flex min-h-9 shrink-0 items-center rounded-md">
			<button
				type="button"
				aria-label={least ? `take ${name} out of your cart` : `less ${name}`}
				disabled={disabled}
				onClick={() => (least ? onTakeOff() : onStep(-1))}
				className="grid size-9 place-items-center rounded-md disabled:opacity-50"
			>
				{least ? (
					<TrashIcon size={15} weight="bold" aria-hidden />
				) : (
					<MinusIcon size={15} weight="bold" aria-hidden />
				)}
			</button>
			<span
				aria-live="polite"
				className="min-w-16 text-center text-sm font-bold tabular-nums"
			>
				{amountShown(text)}
			</span>
			<button
				type="button"
				aria-label={`more ${name}`}
				disabled={disabled}
				onClick={() => onStep(1)}
				className="grid size-9 place-items-center rounded-md disabled:opacity-50"
			>
				<PlusIcon size={15} weight="bold" aria-hidden />
			</button>
		</span>
	)
}
