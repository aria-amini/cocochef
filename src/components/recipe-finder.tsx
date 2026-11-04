/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role --
   APG combobox popup: listbox/option roles on ul/li are the correct pattern;
   the options mix ways to start, recipes and actions, which no native control
   can express. */
import { Dialog } from '@base-ui/react/dialog'
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	ClipboardTextIcon,
	LinkSimpleIcon,
	GlobeHemisphereWestIcon,
	PencilSimpleIcon,
	XIcon,
	CaretDownIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Marked } from '@/components/marked'
import { PasteRecipeDialog } from '@/components/paste-recipe-dialog'
import {
	asRecipeUrl,
	RecipeThumb,
	useOnlineRecipes,
} from '@/components/recipe-online'
import { RecipeReader } from '@/components/recipe-reader'
import { Skeleton } from '@/components/ui/skeleton'
import { popularRecipes, type FoundRecipe } from '@/lib/discover/server'
import { importRecipe } from '@/lib/import/server'
import { matchesRecipeQuery } from '@/lib/recipes/model'
import { isPastedRecipe } from '@/lib/recipes/paste'
import { getRecipe, listShelf } from '@/lib/recipes/server'
import { tileColorFor, tileColors } from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'
import { useVisualViewportVars } from '@/lib/utils/viewport'

type ShelfRecipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

type Start = 'write' | 'import' | 'paste'

type Option =
	| { kind: 'start'; start: Start }
	| { kind: 'recipe'; recipe: FoundRecipe }
	// Bring in this link and open it.
	| { kind: 'link'; url: string }
	// Start a recipe of your own with this name.
	| { kind: 'write'; title: string }

const starts: {
	start: Start
	label: string
	icon: typeof PencilSimpleIcon
}[] = [
	{
		start: 'write',
		label: 'blank recipe',
		icon: PencilSimpleIcon,
	},
	{
		start: 'import',
		label: 'import link',
		icon: LinkSimpleIcon,
	},
	{
		start: 'paste',
		label: 'paste text',
		icon: ClipboardTextIcon,
	},
]

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
		case 'start':
			return `start:${option.start}`
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

// The words a recipe matched on, the same way the server splits them.
function termsOf(query: string) {
	return [
		...new Set(
			query
				.toLowerCase()
				.split(/[^\p{L}\p{N}]+/u)
				.filter((term) => term.length > 1),
		),
	]
}

function fromShelf(recipe: ShelfRecipe): FoundRecipe {
	const owned = recipe.userId !== null

	return {
		recipeId: recipe.id,
		url: recipe.sourceUrl ?? undefined,
		title: recipe.title,
		imageUrl: recipe.imageUrl ?? undefined,
		siteName:
			owned || !recipe.sourceUrl ? 'your recipe' : hostOf(recipe.sourceUrl),
		saved: true,
		draft: owned && !recipe.finalizedAt,
		ingredientMatches: [],
	}
}

// Marks every search word in `text`.
// Why a recipe is in the list, in a few words.
function recipeNote(recipe: FoundRecipe) {
	const base = recipe.saved
		? recipe.draft
			? 'draft'
			: 'on your shelf'
		: recipe.siteName

	return recipe.ingredientMatches.length
		? `${base} · has ${recipe.ingredientMatches.join(', ')}`
		: base
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<li
			role="presentation"
			className="text-muted-foreground px-3 pt-3 pb-1 text-xs font-semibold"
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
	onImportLink,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	defaultQuery: string
	onImportLink: (url?: string) => void
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
					className="bg-background border-foreground/30 fixed inset-x-2 top-[calc(var(--vv-top,0px)+var(--vv-gap,1rem))] z-50 flex h-[calc(var(--vv-height,100dvh)-var(--vv-gap,1rem)-0.5rem)] flex-col overflow-hidden rounded-2xl border shadow-md outline-none md:inset-auto md:top-8 md:left-1/2 md:h-[calc(100dvh-4rem)] md:w-[min(58rem,calc(100vw-4rem))] md:-translate-x-1/2 md:rounded-xl"
				>
					<Dialog.Title className="sr-only">find a recipe</Dialog.Title>
					<FinderPanel
						inputRef={input}
						defaultQuery={defaultQuery}
						close={() => onOpenChange(false)}
						onImportLink={onImportLink}
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
	onImportLink,
}: {
	inputRef: React.RefObject<HTMLInputElement | null>
	defaultQuery: string
	close: () => void
	onImportLink: (url?: string) => void
}) {
	const navigate = useNavigate()
	const listboxId = useId()
	const [pasteOpen, setPasteOpen] = useState(false)
	// The ways to start stay tucked behind one button until asked for.
	const [startsOpen, setStartsOpen] = useState(false)
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
	const [error, setError] = useState<string>()
	// Site pages brought in for a look, by link, so they keep their recipe.
	const [resolved, setResolved] = useState<Record<string, string>>({})
	const [looking, setLooking] = useState<string>()
	const [lookErrors, setLookErrors] = useState<Record<string, string>>({})
	const trimmed = value.trim()
	const url = asRecipeUrl(trimmed)
	const terms = termsOf(trimmed)

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
		section(
			'',
			starts.flatMap(({ start }): Option[] =>
				start === 'write' || startsOpen ? [{ kind: 'start', start }] : [],
			),
		)

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

		section('on your shelf', asOptions(fromServer.slice(0, shelfLimit)))
		section(
			'more recipes',
			asOptions(
				online.results
					.filter((recipe) => !recipe.saved)
					.slice(0, visibleRecipes),
			),
		)
		section('', [{ kind: 'write', title: trimmed }])
	}

	const pickedAt = options.findIndex((option) => optionKey(option) === picked)
	// The first recipe leads when typing; the first way to start when not.
	const firstRecipe = options.findIndex((option) => option.kind !== 'start')

	const active =
		pickedAt >= 0 ? pickedAt : url ? 0 : trimmed ? Math.max(firstRecipe, 0) : -1

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

	const go = async (recipeId: string) => {
		close()
		await navigate({ to: '/recipes/$recipeId', params: { recipeId } })
	}

	const openRecipe = (recipe: FoundRecipe) =>
		run(optionKey({ kind: 'recipe', recipe }), async () =>
			go(await recipeIdFor(recipe)),
		)

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
			case 'start':
				if (option.start === 'write') return write()

				if (option.start === 'import') return onImportLink()

				return setPasteOpen(true)
			case 'recipe':
				setSelected(option.recipe)
				setPicked(optionKey(option))
				setPreviewing(true)

				return
			case 'link': {
				const link = option.url

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
			'mx-2 rounded-lg border',
			index === active ? 'border-foreground/45' : 'border-transparent',
		)

	const searching = trimmed !== '' && !url

	return (
		<>
			<PasteRecipeDialog
				open={pasteOpen}
				onOpenChange={setPasteOpen}
				onAdd={(text) => {
					const link = asRecipeUrl(text.trim())

					if (link) onImportLink(link)
					else writePasted(text)
				}}
			/>
			<div
				className={cn(
					'border-border flex shrink-0 items-center gap-2.5 border-b px-4 py-3',
					previewing && 'hidden',
				)}
			>
				{url ? (
					<LinkSimpleIcon size={20} weight="bold" aria-hidden />
				) : (
					<GlobeHemisphereWestIcon size={20} weight="bold" aria-hidden />
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
					placeholder="Search any Recipe"
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
				<Dialog.Close
					aria-label="cancel"
					className="text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2 py-1 text-sm font-semibold"
				>
					<XIcon size={20} weight="bold" aria-hidden className="md:hidden" />
					<kbd className="border-border hidden rounded border px-1.5 text-xs md:inline">
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
								terms={terms}
								busy={busy}
								optionProps={optionProps}
								rowClassName={rowClassName}
								recipeRowClassName={recipeRowClassName}
								startsOpen={startsOpen}
								onToggleStarts={() => setStartsOpen((open) => !open)}
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
							className="text-muted-foreground mx-3 mb-3 min-h-11 rounded-md px-3 text-sm font-semibold underline underline-offset-4"
						>
							show more recipes
						</button>
					) : null}
					{error ? (
						<p
							role="alert"
							className="text-kitchen-tomato px-4 pb-4 text-sm font-semibold"
						>
							{error}
						</p>
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
							<Dialog.Close
								aria-label="close"
								className="text-muted-foreground hover:text-foreground grid size-11 place-items-center rounded-md md:hidden"
							>
								<XIcon size={18} weight="bold" aria-hidden />
							</Dialog.Close>
						</div>
					) : null}
					{previewing && error ? (
						<p
							role="alert"
							className="text-kitchen-tomato px-4 py-2 text-sm font-semibold"
						>
							{error}
						</p>
					) : null}
					<div ref={previewRef} className="min-h-0 flex-1 overflow-y-auto">
						<Preview
							option={current}
							terms={terms}
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
						<div className="border-border bg-background shrink-0 border-t p-4">
							<button
								type="button"
								disabled={busy !== undefined}
								onClick={() => void openRecipe(current.recipe)}
								className="bg-kitchen-basil flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold disabled:opacity-50"
							>
								<ArrowRightIcon size={18} weight="bold" aria-hidden />
								{busy ? 'one moment…' : 'open recipe'}
							</button>
						</div>
					) : null}
				</div>
			</div>
		</>
	)
}

function SectionRows({
	label,
	options,
	from,
	terms,
	busy,
	optionProps,
	rowClassName,
	recipeRowClassName,
	startsOpen,
	onToggleStarts,
}: {
	label: string
	options: Option[]
	from: number
	terms: string[]
	busy: string | undefined
	optionProps: (index: number, option: Option) => object
	rowClassName: (index: number) => string
	recipeRowClassName: (index: number) => string
	startsOpen: boolean
	onToggleStarts: () => void
}) {
	const startRow = options.every((option) => option.kind === 'start')

	return (
		<>
			{label ? <SectionLabel>{label}</SectionLabel> : null}
			{startRow ? (
				<li role="presentation" className="flex flex-wrap gap-2 px-4 pt-1 pb-2">
					<ul role="group" aria-label="start" className="contents">
						{options.map((option, offset) => {
							if (option.kind !== 'start') return null
							const index = from + offset

							const { label: name, icon: Icon } = starts.find(
								(start) => start.start === option.start,
							) ?? {
								label: '',
								icon: PencilSimpleIcon,
							}

							return (
								<li
									key={option.start}
									{...optionProps(index, option)}
									className={cn(
										rowClassName(index),
										'border-border w-auto rounded-md border px-2.5 py-1.5',
										option.start === 'write' ? 'order-1' : 'order-3',
									)}
								>
									<span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
										<Icon size={14} weight="bold" aria-hidden />
										{name}
									</span>
								</li>
							)
						})}
					</ul>
					{/* Not an option: it only reveals the import ways below. */}
					<button
						type="button"
						aria-expanded={startsOpen}
						onClick={onToggleStarts}
						className="text-muted-foreground hover:text-foreground order-2 flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold whitespace-nowrap"
					>
						import
						<CaretDownIcon
							size={12}
							weight="bold"
							aria-hidden
							className={cn(startsOpen && 'rotate-180')}
						/>
					</button>
				</li>
			) : (
				options.map((option, offset) => {
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
									<span className="block truncate text-sm font-medium">
										<Marked text={recipe.title} terms={terms} />
									</span>
									<span className="text-muted-foreground block truncate text-xs font-semibold">
										{busy === key ? 'one moment…' : recipeNote(recipe)}
									</span>
								</span>
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
									className="border-border bg-kitchen-basil/25 grid size-10 shrink-0 place-items-center rounded-lg border"
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
									className="border-border bg-kitchen-eggplant/15 grid size-10 shrink-0 place-items-center rounded-lg border"
								>
									<PencilSimpleIcon size={18} weight="bold" />
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
				})
			)}
		</>
	)
}

// The highlighted option, up close: a recipe's ingredients with the search
// words marked, and what to do with it.
const startHints: Record<Start, string> = {
	write: 'a blank page: name it, then add ingredients and steps.',
	import: 'paste a link from a recipe site. it lands on your shelf.',
	paste:
		'copied a whole recipe? we sort it into its name, ingredients and steps.',
}

function Preview({
	option,
	terms,
	idOf,
	looking,
	lookError,
}: {
	option: Option | undefined
	terms: string[]
	idOf: (recipe: FoundRecipe) => string | undefined
	looking: boolean
	lookError: string | undefined
}) {
	if (!option || option.kind !== 'recipe')
		return (
			<div className="text-muted-foreground flex flex-col gap-2 p-6 text-sm font-semibold">
				{option?.kind === 'start' ? (
					<p>{startHints[option.start]}</p>
				) : option?.kind === 'write' ? (
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
			terms={terms}
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
	terms,
	looking,
	lookError,
}: {
	recipe: FoundRecipe
	recipeId: string | undefined
	terms: string[]
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
				<RecipeReader recipe={full.data} terms={terms} heading="h2" />
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
					<h2 className="text-xl leading-tight font-bold">
						<Marked text={recipe.title} terms={terms} />
					</h2>
					<p className="text-muted-foreground text-sm font-semibold">
						{recipe.siteName}
					</p>
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
