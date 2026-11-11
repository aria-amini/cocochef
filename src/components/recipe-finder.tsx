/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role --
   APG combobox popup: listbox/option roles on ul/li are the correct pattern;
   the options mix ways to start, recipes and actions, which no native control
   can express. */
import { Dialog } from '@base-ui/react/dialog'
import {
	MagnifyingGlassIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	BookmarkSimpleIcon,
	LinkSimpleIcon,
	PlusIcon,
	StarIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { FieldError } from '@/components/recipe-form'
import {
	asRecipeUrl,
	RecipeThumb,
	useOnlineRecipes,
} from '@/components/recipe-online'
import { RecipeRating } from '@/components/recipe-rating'
import { RecipeReader } from '@/components/recipe-reader'
import { SiteIcon } from '@/components/site-icon'
import type { StartingPoint } from '@/components/start-from'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '@/lib/auth/client'
import { popularRecipes, type FoundRecipe } from '@/lib/discover/server'
import { importRecipe } from '@/lib/import/server'
import { byLoved, lovedScore } from '@/lib/recipes/loved'
import { matchesRecipeQuery } from '@/lib/recipes/model'
import { isPastedRecipe } from '@/lib/recipes/paste'
import { getRecipe, listShelf, saveRecipe } from '@/lib/recipes/server'
import { tileColorFor, tileColors } from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'
import { useVisualViewportVars } from '@/lib/utils/viewport'

type ShelfRecipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

type Option =
	| { kind: 'recipe'; recipe: FoundRecipe }
	// Bring in this link and open it.
	| { kind: 'link'; url: string }
	// Start a recipe of your own with this name.
	| { kind: 'write'; title: string }

const shelfLimit = 5

// Enough to choose from, and few enough that writing your own stays in view.
const foundLimit = 12

const glanceLimit = 3

// Long enough to pass over a row without fetching its page.
const lookDelayMs = 350

// What a highlighted option is, so it stays highlighted when results arrive and
// move it down the list.
function optionKey(option: Option) {
	switch (option.kind) {
		case 'recipe':
			return `recipe:${option.recipe.recipeId ?? option.recipe.url}`
		case 'link':
			return `link:${option.url}`
		case 'write':
			return 'write'
	}
}

function hostOf(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return url
	}
}

function fromShelf(recipe: ShelfRecipe): FoundRecipe {
	const owned = recipe.userId !== null

	return {
		recipeId: recipe.id,
		url: recipe.sourceUrl ?? undefined,
		title: recipe.title,
		imageUrl: recipe.imageUrl ?? undefined,
		// Named only while the source link is still set.
		siteName: recipe.sourceUrl ? hostOf(recipe.sourceUrl) : '',
		saved: true,
		draft: owned && !recipe.finalizedAt,
		ingredientMatches: [],
		rating:
			recipe.ratingValue !== null && recipe.ratingCount
				? { value: recipe.ratingValue, count: recipe.ratingCount }
				: undefined,
	}
}

// Marks every search word in `text`.
// Why a recipe is in the list, in a few words.
function recipeNote(recipe: FoundRecipe) {
	const parts = [
		recipe.saved && recipe.draft ? 'draft' : '',
		recipe.siteName,
		recipe.ingredientMatches.length
			? `has ${recipe.ingredientMatches.join(', ')}`
			: '',
	]

	return parts.filter(Boolean).join(' · ')
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<li
			role="presentation"
			className="text-foreground px-5 pt-4 pb-1.5 text-sm font-bold"
		>
			{children}
		</li>
	)
}

function Status({ children }: { children: React.ReactNode }) {
	return (
		<li
			role="presentation"
			className="text-muted-foreground px-3 py-2 text-sm font-semibold"
		>
			{children}
		</li>
	)
}

// The one box: every way to start a recipe, and every recipe to cook or start
// from. Opened from the shelf's search, ⌘K anywhere, or the phone's round
// button.
export function RecipeFinder({
	children,
	open,
	onOpenChange,
	defaultQuery,
	onUse,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	defaultQuery: string
	// Given, a recipe picked here starts the one being written.
	onUse?: ((start: StartingPoint) => void) | undefined
	children?: React.ReactNode
}) {
	const input = useRef<HTMLInputElement>(null)

	useVisualViewportVars(open)

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
				<Dialog.Popup
					initialFocus={input}
					className="floating bg-background fixed inset-x-2 top-[calc(var(--vv-top)+var(--vv-gap))] z-50 flex h-[min(28rem,calc(var(--vv-height)-var(--vv-gap)-0.5rem))] flex-col overflow-hidden outline-none has-[[data-previewing]]:h-[calc(var(--vv-height)-var(--vv-gap)-0.5rem)] md:inset-auto md:top-[calc(var(--vv-top)+2rem)] md:left-1/2 md:h-[calc(var(--vv-height)-4rem)] md:w-[min(58rem,calc(100vw-4rem))] md:-translate-x-1/2 md:rounded-xl md:has-[[data-previewing]]:h-[calc(var(--vv-height)-4rem)]"
				>
					<Dialog.Title className="sr-only">find a recipe</Dialog.Title>
					<FinderPanel
						inputRef={input}
						defaultQuery={defaultQuery}
						close={() => onOpenChange(false)}
						onUse={onUse}
					/>
				</Dialog.Popup>
			</Dialog.Portal>
			{children}
		</Dialog.Root>
	)
}

function FinderPanel({
	inputRef,
	defaultQuery,
	close,
	onUse,
}: {
	inputRef: React.RefObject<HTMLInputElement | null>
	defaultQuery: string
	close: () => void
	onUse?: ((start: StartingPoint) => void) | undefined
}) {
	const navigate = useNavigate()
	const router = useRouter()
	const client = useQueryClient()
	const account = authClient.useSession().data?.user

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	// Saving asks a visitor to sign in first.
	const [authOpen, setAuthOpen] = useState(false)

	// Recipes saved from here, by link or id, before the shelf catches up.
	const [savedHere, setSavedHere] = useState<ReadonlySet<string>>(
		() => new Set(),
	)

	const listboxId = useId()

	const [value, setValue] = useState(defaultQuery)
	const [picked, setPicked] = useState<string>()
	// Picking a recipe fills the box; results stay mounted for the way back.
	const [previewing, setPreviewing] = useState(false)
	const [selected, setSelected] = useState<FoundRecipe>()
	const backRef = useRef<HTMLButtonElement>(null)
	const previewRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (previewing) {
			previewRef.current?.scrollTo({ top: 0 })
			backRef.current?.focus()
		} else inputRef.current?.focus()
	}, [previewing, inputRef])
	// The option an action is running for, so it can say so.
	const [busy, setBusy] = useState<string>()

	// Results most loved first, rather than best match first.
	const [loved, setLoved] = useState(false)
	const [error, setError] = useState<string>()
	// Site pages brought in for a look, by link, so they keep their recipe.
	const [resolved, setResolved] = useState<Record<string, string>>({})
	const [looking, setLooking] = useState<string>()
	const [lookErrors, setLookErrors] = useState<Record<string, string>>({})
	const trimmed = value.trim()
	const url = asRecipeUrl(trimmed)

	const shelf = useQuery({
		queryKey: ['shelf'],
		queryFn: () => listShelf(),
	})

	const [visibleRecipes, setVisibleRecipes] = useState(foundLimit)

	const popular = useQuery({
		queryKey: ['popular-recipes'],
		queryFn: () => popularRecipes(),
		enabled: trimmed === '',
	})

	const online = useOnlineRecipes(trimmed && !url ? trimmed : undefined)
	const shelfRecipes = shelf.data?.recipes ?? []

	const options: Option[] = []
	const sections: { label: string; from: number; to: number }[] = []

	function section(label: string, added: Option[]) {
		if (added.length === 0) return
		sections.push({
			label,
			from: options.length,
			to: options.length + added.length,
		})
		options.push(...added)
	}

	const asOptions = (recipes: FoundRecipe[]) =>
		recipes.map((recipe): Option => ({ kind: 'recipe', recipe }))

	if (url) {
		section('', [{ kind: 'link', url }])
	} else if (!trimmed) {
		const drafts = shelfRecipes.filter(
			(recipe) => recipe.userId !== null && !recipe.finalizedAt,
		)

		section(
			'still writing',
			asOptions(drafts.slice(0, glanceLimit).map(fromShelf)),
		)

		section(
			'on your shelf',
			asOptions(
				shelfRecipes
					.filter((recipe) => recipe.finalizedAt)
					.slice(0, glanceLimit)
					.map(fromShelf),
			),
		)
		section(
			'popular',
			asOptions((popular.data?.results ?? []).slice(0, visibleRecipes)),
		)
	} else {
		// Names on the shelf match at once; the server adds ingredients.
		const fromServer = online.loading
			? shelfRecipes
					.filter((recipe) => matchesRecipeQuery(recipe.title, trimmed))
					.map(fromShelf)
			: online.results.filter((recipe) => recipe.saved)

		const ranked = (recipes: FoundRecipe[]) =>
			loved ? byLoved(recipes, (recipe) => lovedScore(recipe.rating)) : recipes

		section('on your shelf', asOptions(ranked(fromServer).slice(0, shelfLimit)))
		section(
			'more recipes',
			asOptions(
				ranked(online.results.filter((recipe) => !recipe.saved)).slice(
					0,
					visibleRecipes,
				),
			),
		)

		if (!onUse) section('', [{ kind: 'write', title: trimmed }])
	}

	const pickedAt = options.findIndex((option) => optionKey(option) === picked)

	// The first option leads when typing.
	const active = pickedAt >= 0 ? pickedAt : url || trimmed ? 0 : -1

	const current: Option | undefined =
		previewing && selected
			? { kind: 'recipe', recipe: selected }
			: options[active]

	const lookUrl =
		current?.kind === 'recipe' &&
		!current.recipe.recipeId &&
		current.recipe.url &&
		!resolved[current.recipe.url]
			? current.recipe.url
			: undefined

	// A site page under the highlight is read in after a short pause, so the
	// preview shows its ingredients without fetching every page passed over.
	useEffect(() => {
		if (!lookUrl || lookErrors[lookUrl]) return
		let cancelled = false

		const timer = setTimeout(() => {
			setLooking(lookUrl)
			importRecipe({ data: { url: lookUrl, keep: false } })
				.then((recipe) =>
					setResolved((known) => ({ ...known, [lookUrl]: recipe.id })),
				)
				.catch((cause: unknown) => {
					const message =
						cause instanceof Error ? cause.message : "couldn't read that page"

					// Limits are temporary: keep Open available for an explicit retry.
					if (message.startsWith('too many imports')) {
						setError(message)

						return
					}

					setLookErrors((known) => ({ ...known, [lookUrl]: message }))
				})

				.finally(() => {
					if (!cancelled)
						setLooking((now) => (now === lookUrl ? undefined : now))
				})
		}, lookDelayMs)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [lookUrl, lookErrors])

	const idOf = (recipe: FoundRecipe) =>
		recipe.recipeId ?? (recipe.url ? resolved[recipe.url] : undefined)

	// Runs one action at a time, keeping its option marked busy; a failure
	// stays in the box as a message.
	async function run(key: string, action: () => Promise<void>) {
		if (busy) return
		setBusy(key)
		setError(undefined)

		try {
			await action()
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "couldn't do that — try again",
			)
		} finally {
			setBusy(undefined)
		}
	}

	// A site page is brought in, without going on the shelf, to have a recipe.
	async function recipeIdFor(recipe: FoundRecipe) {
		const known = idOf(recipe)

		if (known) return known

		if (!recipe.url) throw new Error("couldn't find that recipe")

		const brought = await importRecipe({
			data: { url: recipe.url, keep: false },
		})

		const pageUrl = recipe.url

		setResolved((current) => ({ ...current, [pageUrl]: brought.id }))

		return brought.id
	}

	// The search goes along, so the recipe's way back can return to it.
	const go = async (recipeId: string) => {
		close()
		await navigate({
			to: '/recipes/$recipeId',
			params: { recipeId },
			state: trimmed && !url ? { foundBy: trimmed } : {},
		})
	}

	// Hands a recipe's lines to the one being written, read in first if it is
	// only a page so far, without going on the shelf.
	const useFound = (recipe: FoundRecipe) =>
		run(optionKey({ kind: 'recipe', recipe }), async () => {
			const full = await getRecipe({ data: { id: await recipeIdFor(recipe) } })

			if (!full) throw new Error("couldn't read this recipe")
			close()
			onUse?.({
				title: full.title,
				sourceUrl: full.sourceUrl ?? recipe.url,
				ingredients: full.ingredients,
				steps: full.steps,
			})
		})

	const openRecipe = (recipe: FoundRecipe) =>
		run(optionKey({ kind: 'recipe', recipe }), async () =>
			go(await recipeIdFor(recipe)),
		)

	const savedKey = (recipe: FoundRecipe) =>
		recipe.url ?? recipe.recipeId ?? recipe.title

	const isSaved = (recipe: FoundRecipe) =>
		recipe.saved || savedHere.has(savedKey(recipe))

	// Puts a found recipe on the shelf without leaving the search: a site page
	// is brought in and kept in one go.
	const saveFound = (recipe: FoundRecipe) => {
		if (!account || account.isAnonymous) {
			setAuthOpen(true)

			return
		}

		void run(`${optionKey({ kind: 'recipe', recipe })}:save`, async () => {
			const known = idOf(recipe)

			let id = known

			if (known) await saveRecipe({ data: { id: known } })
			else if (recipe.url)
				id = (await importRecipe({ data: { url: recipe.url, keep: true } })).id
			else throw new Error("couldn't find that recipe")

			setSavedHere((current) => new Set(current).add(savedKey(recipe)))
			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: ['shelf'] }),
			])
			toast.success('saved to your recipes', {
				action: id ? { label: 'open', onClick: () => void go(id) } : undefined,
			})
		})
	}

	const write = (title = '') => {
		close()
		void navigate({ to: '/recipes/new', search: title ? { title } : {} })
	}

	const writePasted = (text: string) => {
		close()
		void navigate({ to: '/recipes/new', state: { pasted: text } })
	}

	function activate(option: Option) {
		if (busy) return

		switch (option.kind) {
			case 'recipe':
				setSelected(option.recipe)
				setPicked(optionKey(option))
				setPreviewing(true)

				return
			case 'link': {
				const link = option.url

				if (onUse)
					return void useFound({
						title: hostOf(link),
						url: link,
						siteName: hostOf(link),
						saved: false,
						draft: false,
						ingredientMatches: [],
					})

				return void run(optionKey(option), async () => {
					const recipe = await importRecipe({ data: { url: link, keep: true } })

					toast.success(`${recipe.title} is on your shelf`)
					await go(recipe.id)
				})
			}

			case 'write':
				return write(option.title.slice(0, 120))
		}
	}

	function change(next: string) {
		setVisibleRecipes(foundLimit)
		setValue(next)
		setPicked(undefined)
		setPreviewing(false)
		setError(undefined)
	}

	function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()

			if (options.length === 0) return

			const next =
				event.key === 'ArrowDown'
					? (active + 1) % options.length
					: active <= 0
						? options.length - 1
						: active - 1

			const option = options[next]

			if (option) setPicked(optionKey(option))
		} else if (event.key === 'Enter' && current) {
			event.preventDefault()

			activate(current)
		}
	}

	const optionProps = (index: number, option: Option) => ({
		id: `${listboxId}-${index}`,
		role: 'option' as const,
		'aria-selected': index === active,
		'aria-disabled': busy !== undefined || undefined,
		onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
		// Move, not enter: a list that opens under a resting pointer must not
		// steal the highlight from the keyboard.
		onMouseMove: () => setPicked(optionKey(option)),
		// A recipe is looked at first; saving and opening are explicit actions.
		onClick: () => {
			if (option.kind !== 'recipe') return activate(option)
			setSelected(option.recipe)
			setPicked(optionKey(option))

			setPreviewing(true)
		},
	})

	const rowClassName = (index: number) =>
		cn(
			'flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors',
			index === active && 'bg-kitchen-yolk/40',
			busy !== undefined && 'cursor-default opacity-60',
		)

	// A recipe row is outlined when selected, in a darker line than the faint
	// hairline so it stands out from its neighbours.
	const recipeRowClassName = (index: number) =>
		cn(
			rowClassName(index),
			'mx-2 rounded-md border',
			index === active ? 'border-foreground/45' : 'border-transparent',
		)

	const searching = trimmed !== '' && !url

	return (
		<>
			{/* Always on screen, so a recipe can be left for another search. */}
			<div className="border-border flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
				{url ? (
					<LinkSimpleIcon size={20} weight="bold" aria-hidden />
				) : (
					<MagnifyingGlassIcon size={20} weight="bold" aria-hidden />
				)}
				<input
					ref={inputRef}
					type="text"
					inputMode="search"
					role="combobox"
					aria-label="find a recipe"
					aria-expanded
					aria-controls={listboxId}
					aria-autocomplete="list"
					aria-activedescendant={
						active >= 0 ? `${listboxId}-${active}` : undefined
					}
					autoComplete="off"
					value={value}
					maxLength={2000}
					placeholder="search any recipe"
					onChange={(event) => change(event.target.value)}
					onKeyDown={handleKey}
					onPaste={(event) => {
						const text = event.clipboardData.getData('text')

						if (!isPastedRecipe(text)) return
						event.preventDefault()
						writePasted(text)
					}}
					className="placeholder:text-muted-foreground w-full min-w-0 bg-transparent text-lg font-semibold outline-none placeholder:font-normal"
				/>
				{trimmed && !url && !previewing ? (
					<button
						type="button"
						aria-pressed={loved}
						onClick={() => setLoved((on) => !on)}
						className={cn(
							'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors',
							loved
								? 'border-kitchen-yolk bg-kitchen-yolk/30'
								: 'border-input text-muted-foreground hover:text-foreground border-dashed',
						)}
					>
						<StarIcon
							size={12}
							weight={loved ? 'fill' : 'bold'}
							aria-hidden
							className={loved ? 'text-kitchen-yolk' : undefined}
						/>
						most loved
					</button>
				) : null}
				<Dialog.Close
					aria-label="cancel"
					className="text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2 py-1 text-sm font-semibold"
				>
					<XIcon size={20} weight="bold" aria-hidden className="md:hidden" />
					<kbd className="border-border hidden rounded-md border px-1.5 text-xs md:inline">
						esc
					</kbd>
				</Dialog.Close>
			</div>
			<div
				className={cn(
					'grid min-h-0 flex-1',
					!previewing && 'md:grid-cols-[1.1fr_1fr]',
				)}
			>
				<div className={cn('min-h-0 overflow-y-auto', previewing && 'hidden')}>
					<ul
						id={listboxId}
						role="listbox"
						aria-label="Ways to start and recipes"
						className="pb-3"
					>
						{sections.map(({ label, from, to }) => (
							<SectionRows
								key={label || options[from]?.kind}
								label={label}
								options={options.slice(from, to)}
								from={from}
								busy={busy}
								optionProps={optionProps}
								rowClassName={rowClassName}
								recipeRowClassName={recipeRowClassName}
							/>
						))}
						{searching && online.results.length === 0 ? (
							<Status>
								{online.loading
									? 'looking for recipes…'
									: online.warming
										? 'finding recipes — more appear as sites load'
										: online.failed
											? "couldn't search recipes — try again"
											: 'no other recipes called that yet'}
							</Status>
						) : null}
					</ul>
					{(trimmed
						? online.results.filter((recipe) => !recipe.saved).length
						: (popular.data?.results.length ?? 0)) > visibleRecipes ? (
						<button
							type="button"
							onClick={() => setVisibleRecipes((count) => count + foundLimit)}
							className="text-muted-foreground mx-2 mb-3 min-h-11 rounded-md px-3 text-sm font-semibold underline underline-offset-4"
						>
							show more recipes
						</button>
					) : null}
					{error ? (
						<div className="px-4 pb-4">
							<FieldError>{error}</FieldError>
						</div>
					) : null}
				</div>
				<div
					className={cn(
						'border-border min-h-0 flex-col overflow-hidden',
						!previewing && 'md:flex md:border-l',
						previewing ? 'flex' : 'hidden',
					)}
				>
					{previewing ? (
						<div className="border-border flex items-center justify-between border-b pr-2">
							<button
								type="button"
								ref={backRef}
								onClick={() => {
									setPreviewing(false)
								}}
								className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 px-4 text-sm font-semibold"
							>
								<ArrowLeftIcon size={14} weight="bold" aria-hidden />
								back to results
							</button>
						</div>
					) : null}
					{previewing && error ? (
						<div className="px-4 py-2">
							<FieldError>{error}</FieldError>
						</div>
					) : null}
					<div
						ref={previewRef}
						data-previewing={previewing || undefined}
						className="min-h-0 flex-1 overflow-y-auto"
					>
						<Preview
							option={current}
							idOf={idOf}
							looking={
								current?.kind === 'recipe' && looking === current.recipe.url
							}
							lookError={
								current?.kind === 'recipe' && current.recipe.url
									? lookErrors[current.recipe.url]
									: undefined
							}
						/>
					</div>
					{previewing &&
					current?.kind === 'recipe' &&
					!(
						current.recipe.url &&
						lookErrors[current.recipe.url] &&
						!idOf(current.recipe)
					) ? (
						<div className="border-border bg-background flex shrink-0 gap-2 border-t p-4">
							{onUse ? (
								<button
									type="button"
									disabled={busy !== undefined}
									onClick={() => void useFound(current.recipe)}
									className="bg-kitchen-basil flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold hover:brightness-95 disabled:opacity-50"
								>
									<ArrowRightIcon size={18} weight="bold" aria-hidden />
									{busy ? 'one moment…' : 'use this recipe'}
								</button>
							) : (
								<>
									{/* Saving keeps the cook in the search; opening goes to the
							    recipe. */}
									{isSaved(current.recipe) ? (
										<span className="text-kitchen-eggplant bg-kitchen-eggplant/10 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold">
											<BookmarkSimpleIcon size={18} weight="fill" aria-hidden />
											saved
										</span>
									) : (
										<button
											type="button"
											disabled={busy !== undefined}
											onClick={() => saveFound(current.recipe)}
											className="bg-kitchen-basil flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold hover:brightness-95 disabled:opacity-50"
										>
											<BookmarkSimpleIcon size={18} weight="bold" aria-hidden />
											{busy?.endsWith(':save') ? 'saving…' : 'save'}
										</button>
									)}
									<button
										type="button"
										disabled={busy !== undefined}
										onClick={() => void openRecipe(current.recipe)}
										className="border-foreground/40 hover:bg-card flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-base font-semibold transition-colors disabled:opacity-50"
									>
										<ArrowRightIcon size={18} weight="bold" aria-hidden />
										{busy && !busy.endsWith(':save')
											? 'one moment…'
											: 'open recipe'}
									</button>
								</>
							)}
						</div>
					) : null}
				</div>
			</div>
			<AuthDialog
				open={authOpen}
				onOpenChange={setAuthOpen}
				redirect={pathname}
				onSuccess={() => void router.invalidate()}
			/>
		</>
	)
}

function SectionRows({
	label,
	options,
	from,
	busy,
	optionProps,
	rowClassName,
	recipeRowClassName,
}: {
	label: string
	options: Option[]
	from: number
	busy: string | undefined
	optionProps: (index: number, option: Option) => object
	rowClassName: (index: number) => string
	recipeRowClassName: (index: number) => string
}) {
	return (
		<>
			{label ? <SectionLabel>{label}</SectionLabel> : null}
			{options.map((option, offset) => {
				const index = from + offset

				if (option.kind === 'recipe') {
					const { recipe } = option
					const key = optionKey(option)

					return (
						<li
							key={key}
							{...optionProps(index, option)}
							className={recipeRowClassName(index)}
						>
							<RecipeThumb
								imageUrl={recipe.imageUrl}
								title={recipe.title}
								className={
									recipe.recipeId
										? tileColors[tileColorFor(recipe.recipeId)]
										: undefined
								}
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold">
									{recipe.title}
								</span>
								{busy === key || recipeNote(recipe) ? (
									<span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
										{recipe.siteName ? <SiteIcon url={recipe.url} /> : null}
										<span className="truncate">
											{busy === key ? 'one moment…' : recipeNote(recipe)}
										</span>
									</span>
								) : null}
							</span>
							{/* The stars keep a column of their own at the row's end, so
							    they line up down the list. */}
							{recipe.rating ? (
								<RecipeRating
									rating={recipe.rating}
									column
									className="shrink-0 text-xs font-semibold"
								/>
							) : null}
						</li>
					)
				}

				if (option.kind === 'link')
					return (
						<li
							key="link"
							{...optionProps(index, option)}
							className={rowClassName(index)}
						>
							<span
								aria-hidden
								className="border-border bg-kitchen-basil/25 grid size-10 shrink-0 place-items-center rounded-md border"
							>
								<LinkSimpleIcon size={18} weight="bold" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-semibold">
									import this recipe
								</span>
								<span className="text-muted-foreground block truncate text-xs font-semibold">
									{busy
										? 'grabbing the page — some sites make us knock twice'
										: hostOf(option.url)}
								</span>
							</span>
						</li>
					)

				if (option.kind === 'write')
					return (
						<li
							key="write"
							{...optionProps(index, option)}
							className={cn(
								rowClassName(index),
								'border-border mt-1 border-t pt-2.5',
							)}
						>
							<span
								aria-hidden
								className="border-border bg-kitchen-eggplant/15 grid size-10 shrink-0 place-items-center rounded-md border"
							>
								<PlusIcon size={18} weight="bold" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold">
									write “{option.title}”
								</span>
								<span className="text-muted-foreground block text-xs font-semibold">
									start blank
								</span>
							</span>
						</li>
					)

				return null
			})}
		</>
	)
}

// The highlighted option, up close: a recipe's ingredients, and what to do
// with it.
function Preview({
	option,
	idOf,
	looking,
	lookError,
}: {
	option: Option | undefined
	idOf: (recipe: FoundRecipe) => string | undefined
	looking: boolean
	lookError: string | undefined
}) {
	if (!option || option.kind !== 'recipe')
		return (
			<div className="text-muted-foreground flex flex-col gap-2 p-6 text-sm font-semibold">
				{option?.kind === 'write' ? (
					<p>start a blank recipe called “{option.title}”.</p>
				) : option?.kind === 'link' ? (
					<p>import the recipe on {hostOf(option.url)} to your shelf.</p>
				) : (
					<p>
						type a dish or what you have — “chicken thighs lemon” — to find a
						recipe to save or start from.
					</p>
				)}
			</div>
		)

	const { recipe } = option
	const id = idOf(recipe)

	return (
		<RecipePreview
			key={id ?? recipe.url}
			recipe={recipe}
			recipeId={id}
			looking={looking}
			lookError={lookError}
		/>
	)
}

function IngredientsLoading({ label }: { label: string }) {
	return (
		<div aria-busy className="flex flex-col gap-2">
			<p className="text-muted-foreground text-sm font-semibold">{label}</p>
			<Skeleton className="h-3.5 w-4/5" />
			<Skeleton className="h-3.5 w-3/5" />
			<Skeleton className="h-3.5 w-2/3" />
			<Skeleton className="h-3.5 w-2/5" />
		</div>
	)
}

// A found recipe up close. Once it is on the shelf it reads exactly as it does
// on its own page; before that, a title and a note while it is fetched.
// A found recipe up close. Once it is on the shelf it reads exactly as it does
// on its own page; before that, a title and a note while it is fetched.
function RecipePreview({
	recipe,
	recipeId,
	looking,
	lookError,
}: {
	recipe: FoundRecipe
	recipeId: string | undefined
	looking: boolean
	lookError: string | undefined
}) {
	const full = useQuery({
		queryKey: ['recipe', recipeId],
		queryFn: () => getRecipe({ data: { id: recipeId ?? '' } }),
		enabled: recipeId !== undefined,
	})

	if (full.data)
		return (
			<div className="p-4 md:p-6">
				<RecipeReader recipe={full.data} heading="h2" />
			</div>
		)

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-start gap-3">
				{recipe.imageUrl ? (
					<img
						src={recipe.imageUrl}
						alt=""
						referrerPolicy="no-referrer"
						className="border-border size-20 shrink-0 rounded-xl border object-cover md:size-24"
					/>
				) : null}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<h2 className="text-xl leading-tight font-bold">{recipe.title}</h2>
					{recipe.siteName || recipe.rating ? (
						<p className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
							{recipe.siteName ? (
								<>
									<SiteIcon url={recipe.url} />
									{recipe.siteName}
								</>
							) : null}
							{recipe.rating ? <RecipeRating rating={recipe.rating} /> : null}
						</p>
					) : null}
				</div>
			</div>
			{recipeId === undefined && lookError ? (
				<p className="text-muted-foreground text-sm font-semibold">
					{lookError}.{' '}
					{recipe.url ? (
						<a
							href={recipe.url}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground underline"
						>
							see the page on {hostOf(recipe.url)}
						</a>
					) : null}
				</p>
			) : full.isError || full.isSuccess ? (
				<p role="alert" className="text-muted-foreground text-sm font-semibold">
					couldn&apos;t read this recipe — try opening it.
				</p>
			) : (
				<IngredientsLoading
					label={
						recipeId === undefined
							? looking
								? `reading the recipe from ${recipe.siteName}…`
								: 'one moment…'
							: 'reading the recipe…'
					}
				/>
			)}
		</div>
	)
}
