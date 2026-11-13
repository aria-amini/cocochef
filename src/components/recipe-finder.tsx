/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role --
   APG combobox popup: listbox/option roles on ul/li are the correct pattern;
   the options mix ways to start, recipes and actions, which no native control
   can express. */
import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import {
	MagnifyingGlassIcon,
	ArrowLeftIcon,
	ArrowsDownUpIcon,
	GaugeIcon,
	CaretDownIcon,
	CheckIcon,
	SnowflakeIcon,
	ThermometerColdIcon,
	ThermometerHotIcon,
	ThermometerSimpleIcon,
	ForkKnifeIcon,
	ArrowRightIcon,
	LinkSimpleIcon,
	PlusIcon,
	StarIcon,
	UsersThreeIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { CourseIcon, ProteinIcon } from '@/components/course-icon'
import { effortTints } from '@/components/effort-card'
import {
	ActiveFilter,
	FilterPanel,
	type FilterGroup,
	partBubbles,
	partGlyphs,
} from '@/components/meal-bubbles'
import { whileLoading } from '@/components/navigation-progress'
import { FieldError } from '@/components/recipe-form'
import {
	asRecipeUrl,
	RecipeThumb,
	useOnlineRecipes,
} from '@/components/recipe-online'
import { compactCount, RecipeRating } from '@/components/recipe-rating'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeTags } from '@/components/recipe-tags'
import { SaveChip } from '@/components/save-chip'
import { ShopView } from '@/components/shop-view'
import { SiteIcon } from '@/components/site-icon'
import type { StartingPoint } from '@/components/start-from'
import { Skeleton } from '@/components/ui/skeleton'
import {
	countParts,
	courseNames,
	coursesOf,
	fitsPicks,
	hasPicks,
	mealTags,
	type MealPicks,
	type MealTags,
	proteinGroupOf,
	temperatureOf,
	temperatures,
} from '@/lib/assistant/meal-parts'
import { authClient } from '@/lib/auth/client'
import { popularRecipes, type FoundRecipe } from '@/lib/discover/server'
import { importRecipe, peekRecipes } from '@/lib/import/server'
import {
	effortLevel,
	effortPerMeal,
	type RecipeEffort,
} from '@/lib/recipes/effort'
import { type RecipeSort, recipeSorts } from '@/lib/recipes/loved'
import { matchesRecipeQuery } from '@/lib/recipes/model'
import { isPastedRecipe } from '@/lib/recipes/paste'
import {
	getRecipe,
	listShelf,
	removeSavedRecipe,
	saveRecipe,
} from '@/lib/recipes/server'
import { tileColorFor, tileColors } from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'
import { useKeyboardInset } from '@/lib/utils/viewport'

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

// How far a list laid flat in a page goes on by itself before it asks.
const scrollsOnTo = 60

// How many result pages go to be read in the background at once.
const peekBatch = 4

// The open recipe's actions: small pills, as under a recipe page's title.
const actionClassName =
	'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors disabled:opacity-50'

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

// The parts of a meal a recipe was tagged with, or what its title names when
// the search sent none (a shelf glance); undefined when it isn't a meal.
function tagsOf(recipe: FoundRecipe): MealTags | undefined {
	return recipe.tags === undefined
		? mealTags(recipe.title)
		: (recipe.tags ?? undefined)
}

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

// Rows in outline while recipes load: a photo, a name, and a line under it.
function LoadingRows() {
	return [0, 1, 2, 3].map((row) => (
		<li
			key={row}
			aria-hidden
			className="flex items-start gap-3 px-3 py-2 motion-safe:animate-pulse"
		>
			<span className="bg-muted size-18 shrink-0 rounded-xl md:size-28" />
			<span className="flex flex-1 flex-col gap-2 pt-1">
				<span className="bg-muted h-4 w-3/5 rounded-full" />
				<span className="bg-muted h-3 w-2/5 rounded-full" />
				<span className="bg-muted h-3 w-1/4 rounded-full" />
			</span>
		</li>
	))
}

function Status({ children }: { children: React.ReactNode }) {
	return (
		<li
			role="presentation"
			className="text-muted-foreground px-5 pt-4 pb-1.5 text-sm font-semibold"
		>
			{children}
		</li>
	)
}

// The one box, over the editor: a recipe found to start a new one from.
export function RecipeFinder({
	children,
	open,
	onDismiss,
	onLeave,
	defaultQuery,
	onUse,
}: {
	open: boolean
	// Closed where it stands: escape, the cross, a tap outside.
	onDismiss: () => void
	// Closed on the way somewhere else.
	onLeave: () => void
	defaultQuery: string
	// Given, a recipe picked here starts the one being written.
	onUse?: ((start: StartingPoint) => void) | undefined
	children?: React.ReactNode
}) {
	const input = useRef<HTMLInputElement>(null)

	useKeyboardInset(open)

	return (
		<Dialog.Root open={open} onOpenChange={(next) => !next && onDismiss()}>
			<Dialog.Portal>
				<Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
				<Dialog.Popup
					initialFocus={input}
					// Full screen on a phone, with the keyboard over its bottom.
					className="bg-background md:floating fixed inset-x-0 top-0 z-50 flex h-dvh flex-col overflow-hidden outline-none md:inset-auto md:top-8 md:left-1/2 md:h-[calc(100dvh-4rem)] md:w-[min(58rem,calc(100vw-4rem))] md:-translate-x-1/2"
				>
					<Dialog.Title className="sr-only">find a recipe</Dialog.Title>
					<FinderPanel
						inputRef={input}
						defaultQuery={defaultQuery}
						close={onLeave}
						onUse={onUse}
					/>
				</Dialog.Popup>
			</Dialog.Portal>
			{children}
		</Dialog.Root>
	)
}

// What narrows the finder's lists: the kinds of dish, parts of a meal, and
// sites, any number of each; and how they are ordered.
export type FinderFilters = {
	types?: readonly string[] | undefined
	temps?: readonly string[] | undefined
	// The rating sorts ask the server; effort orders what came back.
	sort?: FinderSort | undefined
	picks: MealPicks
	sites?: readonly string[] | undefined
}

type FinderSort = RecipeSort | 'effort'

const finderSorts: readonly FinderSort[] = [...recipeSorts, 'effort']

// The work a meal a found recipe asks, for ordering by effort; what is not
// known goes last.
const workOf = (recipe: FoundRecipe) =>
	(recipe.effort &&
		effortPerMeal(
			recipe.effort,
			recipe.stock?.total ? recipe.stock.need.length : undefined,
		)?.perMeal) ??
	Number.POSITIVE_INFINITY

// The finder laid flat in a page: its filters are the page's, and a recipe
// picked opens its own page.
export type InlineFinder = {
	filters: FinderFilters
	onFilters: (filters: FinderFilters) => void
	// Whether the search was asked for, and wants the keyboard.
	focus?: boolean | undefined
}

export function FinderPanel({
	inputRef,
	defaultQuery,
	close,
	onUse,
	inline,
}: {
	inputRef: React.RefObject<HTMLInputElement | null>
	defaultQuery: string
	close: () => void
	onUse?: ((start: StartingPoint) => void) | undefined
	inline?: InlineFinder | undefined
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

	// Recipes saved or taken off from here, by link or id, before the shelf
	// catches up.
	const [savedHere, setSavedHere] = useState<ReadonlyMap<string, boolean>>(
		() => new Map(),
	)

	// What a saved or unsaved result is known by, and whether it is saved now:
	// what was done here counts before the search is read again.
	const savedKey = (recipe: FoundRecipe) =>
		recipe.url ?? recipe.recipeId ?? recipe.title

	const isSaved = (recipe: FoundRecipe) =>
		savedHere.get(savedKey(recipe)) ?? recipe.saved

	const listboxId = useId()

	const [value, setValue] = useState(defaultQuery)
	const [picked, setPicked] = useState<string>()
	// Picking a recipe fills the box; results stay mounted for the way back.
	const [previewing, setPreviewing] = useState(false)
	const [selected, setSelected] = useState<FoundRecipe>()

	// A recipe picked is looked at in the box, the results kept behind it.
	function preview(recipe: FoundRecipe) {
		// Laid flat on home, the row says enough: it opens the recipe itself.
		if (inline) {
			void openRecipe(recipe)

			return
		}

		setSelected(recipe)
		setPicked(optionKey({ kind: 'recipe', recipe }))
		setPreviewing(true)
	}

	const backRef = useRef<HTMLButtonElement>(null)
	const previewRef = useRef<HTMLDivElement>(null)
	// Laid flat, the input takes the keyboard only when a search was asked
	// for; read once as a flag, so the page drawing again never pulls focus.
	const wantsFocus = !inline || inline.focus === true

	useEffect(() => {
		if (previewing) {
			previewRef.current?.scrollTo({ top: 0 })
			backRef.current?.focus()
		} else if (wantsFocus) inputRef.current?.focus()
	}, [previewing, inputRef, wantsFocus])
	// The option an action is running for, so it can say so.
	const [busy, setBusy] = useState<string>()

	// How the list is ordered besides by match: the most loved or the most
	// rated first, from everywhere.
	// Parts of a meal picked in the bubbles, which narrow every list, and the
	// recipe site picked in its bubble, by name. Laid flat in a page, these are
	// the page's.
	const [ownFilters, setOwnFilters] = useState<FinderFilters>({ picks: {} })

	// The filter panel, and the kind of filter it shows.
	const [panelOpen, setPanelOpen] = useState(false)
	const [panelKey, setPanelKey] = useState<FilterKey>('type')
	const filters = inline?.filters ?? ownFilters
	const setFilters = inline?.onFilters ?? setOwnFilters
	const { sort, picks } = filters
	const sites = filters.sites ?? []

	const setSort = (next: FinderSort | undefined) =>
		setFilters({ ...filters, sort: next })

	// A sort by rating searches everything; by effort, the list as it is.
	const ratingSort = sort === 'effort' ? undefined : sort

	const setPicks = (update: (now: MealPicks) => MealPicks) =>
		setFilters({ ...filters, picks: update(filters.picks) })

	const setSites = (next: string[]) => setFilters({ ...filters, sites: next })

	const types = filters.types ?? []
	const setTypes = (next: string[]) => setFilters({ ...filters, types: next })

	const temps = filters.temps ?? []
	const setTemps = (next: string[]) => setFilters({ ...filters, temps: next })

	const ofTemps = (recipe: FoundRecipe) => {
		const temp = temperatureOf(recipe.title)

		return temps.length === 0 || (temp !== undefined && temps.includes(temp))
	}

	const ofTypes = (recipe: FoundRecipe) =>
		types.length === 0 ||
		coursesOf(recipe.title).some((course) => types.includes(course))

	const onSites = (recipe: FoundRecipe) =>
		sites.length === 0 || sites.includes(recipe.siteName)

	const [error, setError] = useState<string>()
	// Site pages brought in for a look, by link, so they keep their recipe.
	const [resolved, setResolved] = useState<Record<string, string>>({})

	// What those pages said once read: their readers' stars, how long they
	// take, and how much of them the kitchen has, for their rows to show.
	const [readPages, setReadPages] = useState<
		Record<
			string,
			Pick<FoundRecipe, 'rating' | 'totalMinutes' | 'stock' | 'effort'>
		>
	>({})

	const [looking, setLooking] = useState<string>()
	// Pages already sent to be read in the background, so none goes twice.
	const peeked = useRef(new Set<string>())
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
		enabled: trimmed === '' && ratingSort === undefined,
	})

	// Words, or a sort by rating with or without them, search everything.
	const searching = !url && (trimmed !== '' || ratingSort !== undefined)
	const online = useOnlineRecipes(searching ? trimmed : undefined, ratingSort)
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

	// A site page's row takes the rating its page gave, once it is read.
	const rated = (recipe: FoundRecipe): FoundRecipe => {
		const read = recipe.url ? readPages[recipe.url] : undefined

		if (!read) return recipe

		return {
			...recipe,
			rating: recipe.rating ?? read.rating,
			totalMinutes: recipe.totalMinutes ?? read.totalMinutes,
			stock: recipe.stock ?? read.stock,
			effort: recipe.effort ?? read.effort,
		}
	}

	const asOptions = (recipes: FoundRecipe[]) =>
		recipes.map((recipe): Option => ({ kind: 'recipe', recipe: rated(recipe) }))

	// Every recipe the lists draw from, before the bubbles narrow them, so
	// each bubble counts what picking it would leave.
	const pool: FoundRecipe[] = []

	const fitsMeal = (recipe: FoundRecipe) => {
		if (!hasPicks(picks)) return true
		const tags = tagsOf(recipe)

		return tags !== undefined && fitsPicks(tags, picks)
	}

	// How many recipes the main list could show once filtered, so "show more"
	// appears only while another click reveals one.
	let listable = 0

	const narrowed = (recipes: FoundRecipe[]) => {
		pool.push(...recipes)

		const kept =
			!hasPicks(picks) &&
			sites.length === 0 &&
			types.length === 0 &&
			temps.length === 0
				? recipes
				: recipes.filter(
						(recipe) =>
							fitsMeal(recipe) &&
							onSites(recipe) &&
							ofTypes(recipe) &&
							ofTemps(recipe),
					)

		// By effort, the least work a meal first, as read so far.
		return sort === 'effort'
			? [...kept].sort((a, b) => workOf(rated(a)) - workOf(rated(b)))
			: kept
	}

	if (url) {
		section('', [{ kind: 'link', url }])
	} else if (!searching) {
		// The shelf is already on screen behind the box, so an empty search
		// browses what others cook.
		section(
			'popular',
			asOptions(
				(() => {
					const shown = narrowed(popular.data?.results ?? [])
					listable = shown.length

					return shown.slice(0, visibleRecipes)
				})(),
			),
		)
	} else {
		// Names on the shelf match at once; the server adds ingredients, and
		// knows the ratings.
		const fromServer = online.loading
			? ratingSort === undefined
				? shelfRecipes
						.filter((recipe) => matchesRecipeQuery(recipe.title, trimmed))
						.map(fromShelf)
				: []
			: online.results.filter(isSaved)

		section(
			'on your shelf',
			asOptions(narrowed(fromServer).slice(0, shelfLimit)),
		)
		section(
			'more recipes',
			asOptions(
				(() => {
					const shown = narrowed(
						online.results.filter((recipe) => !isSaved(recipe)),
					)

					listable = shown.length

					return shown.slice(0, visibleRecipes)
				})(),
			),
		)

		// Nothing exists by that name: writing it is the way on. Recipes hidden
		// by a bubble do exist, so they don't count as nothing.
		if (
			trimmed &&
			!onUse &&
			options.length === 0 &&
			pool.length === 0 &&
			!online.loading &&
			!online.failed
		)
			section('', [{ kind: 'write', title: trimmed }])
	}

	// Within the picked site, so a part is offered only if picking it leaves
	// something on that site.
	const partCounts = countParts(
		[
			...new Map(
				pool.flatMap((recipe): [string, FoundRecipe][] =>
					onSites(recipe) && ofTypes(recipe) && ofTemps(recipe)
						? [[recipe.recipeId ?? recipe.url ?? recipe.title, recipe]]
						: [],
				),
			).values(),
		].flatMap((recipe) => tagsOf(recipe) ?? []),
		picks,
	)

	// The sites the list holds, with the other picks, most recipes first; the
	// one picked stays offered so it can be taken off.
	const siteLinks = new Map<string, string | undefined>()
	const siteTally = new Map<string, number>()

	for (const recipe of pool)
		if (
			recipe.siteName &&
			fitsMeal(recipe) &&
			ofTypes(recipe) &&
			ofTemps(recipe)
		) {
			siteLinks.set(recipe.siteName, recipe.url)
			siteTally.set(recipe.siteName, (siteTally.get(recipe.siteName) ?? 0) + 1)
		}

	for (const site of sites) if (!siteTally.has(site)) siteTally.set(site, 0)

	const siteOptions = [...siteTally]
		.sort((a, b) => b[1] - a[1])
		.map(([name, count]) => ({ name, sprite: '', count }))

	// The kinds of dish the list holds, with the other picks, in a meal's
	// order; one picked stays offered so it can be taken off.
	const typeTally = new Map<string, number>()

	for (const recipe of pool)
		if (fitsMeal(recipe) && onSites(recipe) && ofTemps(recipe)) {
			for (const course of coursesOf(recipe.title))
				typeTally.set(course, (typeTally.get(course) ?? 0) + 1)
		}

	const typeOptions = courseNames.flatMap((name) => {
		const count = typeTally.get(name) ?? 0

		return [{ name, sprite: '', count }]
	})

	// How the list's dishes are eaten, with the other picks.
	const tempTally = new Map<string, number>()

	for (const recipe of pool) {
		const temp = temperatureOf(recipe.title)

		if (temp && fitsMeal(recipe) && onSites(recipe) && ofTypes(recipe))
			tempTally.set(temp, (tempTally.get(temp) ?? 0) + 1)
	}

	const tempOptions = temperatures.flatMap((name) => {
		const count = tempTally.get(name) ?? 0

		return [{ name, sprite: '', count }]
	})

	const pick = (key: keyof MealPicks, names: string[]) =>
		setPicks((now) => ({ ...now, [key]: names }))

	// Every kind of filter, in the panel's order.
	const groups: (FilterGroup & { key: FilterKey })[] = [
		{
			key: 'type',
			label: filterLabels.type,
			glyph: filterGlyphs.type,
			value: types,
			options: typeOptions,
			onPick: setTypes,
			icon: (name) => <CourseIcon course={name} size={16} />,
		},
		{
			key: 'temp',
			label: filterLabels.temp,
			glyph: filterGlyphs.temp,
			value: temps,
			options: tempOptions,
			onPick: setTemps,
			icon: (name) =>
				name === 'frozen' ? (
					<SnowflakeIcon size={16} weight="bold" />
				) : name === 'cool' ? (
					<ThermometerColdIcon size={16} weight="bold" />
				) : (
					<ThermometerHotIcon size={16} weight="bold" />
				),
		},
		...partBubbles.map((bubble) => ({
			key: bubble.key,
			label: bubble.label,
			glyph: filterGlyphs[bubble.key],
			value: picks[bubble.key] ?? [],
			options: partCounts[bubble.counts],
			onPick: (names: string[]) => pick(bubble.key, names),
			within: bubble.within,
			icon:
				bubble.key === 'protein'
					? (name: string) => (
							<ProteinIcon
								protein={name}
								group={proteinGroupOf(name)}
								size={16}
							/>
						)
					: undefined,
		})),
		{
			key: 'site',
			label: filterLabels.site,
			glyph: filterGlyphs.site,
			value: sites,
			options: siteOptions,
			onPick: setSites,
			icon: (name) => <SiteIcon url={siteLinks.get(name)} />,
		},
	]

	const pickedAt = options.findIndex((option) => optionKey(option) === picked)

	const active = pickedAt >= 0 ? pickedAt : url || trimmed ? 0 : -1

	const current: Option | undefined =
		previewing && selected
			? { kind: 'recipe', recipe: rated(selected) }
			: options[active]

	// Laid flat there is no preview to fill, so nothing is read ahead.
	const lookUrl =
		!inline &&
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
				.then((recipe) => {
					setResolved((known) => ({ ...known, [lookUrl]: recipe.id }))
					keepRead(lookUrl, recipe)
				})
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

	// The pages in view are read in the background, a few at a time, so every
	// row shows its stars and opens at once, without waiting for a pointer or
	// a tap to land on it first.
	const unread = options
		.slice(0, foundLimit)
		.flatMap((option) =>
			option.kind === 'recipe' &&
			!option.recipe.recipeId &&
			option.recipe.url &&
			!resolved[option.recipe.url] &&
			!lookErrors[option.recipe.url] &&
			!peeked.current.has(option.recipe.url)
				? [option.recipe.url]
				: [],
		)
		.slice(0, peekBatch)

	const peeking = unread.join(' ')

	useEffect(() => {
		const urls = peeking ? peeking.split(' ') : []

		if (!urls.length) return

		for (const url of urls) peeked.current.add(url)
		void peekRecipes({ data: { urls } })
			.then((read) => {
				setResolved((known) => ({
					...known,
					...Object.fromEntries(read.map((page) => [page.url, page.id])),
				}))

				for (const page of read)
					keepRead(page.url, page, {
						stock: page.stock ?? undefined,
						effort: page.effort ?? undefined,
					})
			})
			// Unread rows still open on a click.
			.catch(() => undefined)
	}, [peeking])

	function keepRead(
		pageUrl: string,
		recipe: {
			ratingValue: number | null
			ratingCount: number | null
			totalMinutes: number | null
		},
		found?: Pick<FoundRecipe, 'stock' | 'effort'>,
	) {
		const rating =
			recipe.ratingValue !== null && recipe.ratingCount
				? { value: recipe.ratingValue, count: recipe.ratingCount }
				: undefined

		setReadPages((known) => ({
			...known,
			[pageUrl]: {
				rating,
				totalMinutes: recipe.totalMinutes ?? undefined,
				stock: found?.stock,
				effort: found?.effort,
			},
		}))
	}

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
		keepRead(pageUrl, brought)

		return brought.id
	}

	// The search goes along, even an empty one, so the recipe's way back
	// returns to it rather than to the shelf.
	const go = async (recipeId: string) => {
		close()

		// Home keeps the search's words in its address, so the way back finds
		// them again.
		if (
			inline &&
			!url &&
			router.state.location.pathname === '/' &&
			(router.state.location.search.q ?? '') !== trimmed
		)
			await navigate({
				to: '/',
				search: trimmed ? { q: trimmed } : {},
				replace: true,
			})

		await navigate({
			to: '/recipes/$recipeId',
			params: { recipeId },
			state: url ? {} : { foundBy: trimmed },
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

	// The page's loading bar shows while a site's page is read in, as it does
	// for the page it opens.
	const openRecipe = (recipe: FoundRecipe) =>
		run(optionKey({ kind: 'recipe', recipe }), () => {
			const at = router.state.location.pathname

			return whileLoading(async () => {
				const id = await recipeIdFor(recipe)

				// Left for another page while it was read: it stays left.
				if (router.state.location.pathname === at) await go(id)
			})
		})

	// Puts a found recipe on the shelf without leaving the search: a site page
	// is brought in and kept in one go.
	const saveFound = (recipe: FoundRecipe) => {
		if (!account) {
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

			setSavedHere((current) => new Map(current).set(savedKey(recipe), true))

			// A page brought in to be kept is known by its id from here on, so it
			// can be taken off again even if no background read found it.
			if (id && recipe.url) {
				const { url } = recipe

				setResolved((current) => ({ ...current, [url]: id }))
			}

			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: ['shelf'] }),
			])
			// At the bottom: on phones a toast at the top would cover the bar's
			// way back while the search stays open.
			toast.success('saved to your recipes', {
				position: 'bottom-center',
				action: id ? { label: 'open', onClick: () => void go(id) } : undefined,
			})
		})
	}

	// Takes a recipe back off the shelf, from its row.
	const unsaveFound = (recipe: FoundRecipe) => {
		const known = idOf(recipe)

		if (!known) return

		void run(`${optionKey({ kind: 'recipe', recipe })}:save`, async () => {
			await removeSavedRecipe({ data: { id: known } })
			setSavedHere((current) => new Map(current).set(savedKey(recipe), false))
			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: ['shelf'] }),
			])
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
				return preview(option.recipe)
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
			preview(option.recipe)
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

	// What to do with the open recipe, under its title as on its own page:
	// start the one being written from it. A page that couldn't be read
	// offers nothing.
	const actions =
		onUse &&
		current?.kind === 'recipe' &&
		!(
			current.recipe.url &&
			lookErrors[current.recipe.url] &&
			!idOf(current.recipe)
		) ? (
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={busy !== undefined}
					onClick={() => void useFound(current.recipe)}
					className={cn(
						actionClassName,
						'bg-foreground text-background hover:bg-foreground/85',
					)}
				>
					<ArrowRightIcon size={16} weight="bold" aria-hidden />
					{busy ? 'one moment…' : 'use this recipe'}
				</button>
			</div>
		) : null

	return (
		<>
			{/* Always on screen, so a recipe can be left for another search. */}
			<div className="border-border flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
				{/* While a recipe is open, the bar's icon is the way back to it. */}
				{previewing ? (
					<button
						type="button"
						ref={backRef}
						aria-label="back to results"
						onClick={() => setPreviewing(false)}
						className="hover:bg-muted -m-1.5 grid size-8 shrink-0 place-items-center rounded-md"
					>
						<ArrowLeftIcon size={20} weight="bold" aria-hidden />
					</button>
				) : url ? (
					<LinkSimpleIcon
						size={20}
						weight="bold"
						aria-hidden
						className="shrink-0"
					/>
				) : (
					<MagnifyingGlassIcon
						size={20}
						weight="bold"
						aria-hidden
						className="shrink-0"
					/>
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
				{inline ? null : (
					<Dialog.Close
						aria-label="cancel"
						className="text-muted-foreground hover:text-foreground hover:bg-muted -m-1.5 grid size-8 shrink-0 place-items-center rounded-md"
					>
						<XIcon size={20} weight="bold" aria-hidden />
					</Dialog.Close>
				)}
			</div>
			{!url && !previewing ? (
				// The filters and the sort share one bar: what the list holds, then
				// its order at the far end.
				<div className="border-border flex shrink-0 items-start gap-2 border-b px-4 py-2">
					<ul
						aria-label="narrow by"
						className="flex min-w-0 flex-1 gap-2 overflow-x-auto md:flex-wrap"
					>
						<li className="shrink-0">
							<FilterPanel
								groups={groups}
								open={panelOpen}
								onOpenChange={setPanelOpen}
								active={panelKey}
								onActive={(key) => {
									const group = groups.find((each) => each.key === key)

									if (group) setPanelKey(group.key)
								}}
							/>
						</li>
						{groups.map((group) =>
							group.value.length ? (
								<li key={group.key} className="shrink-0">
									<ActiveFilter
										group={group}
										onOpen={() => {
											setPanelKey(group.key)
											setPanelOpen(true)
										}}
									/>
								</li>
							) : null,
						)}
					</ul>
					{searching || inline ? (
						<SortLine sort={sort} onSort={setSort} />
					) : null}
				</div>
			) : null}
			<div
				className={cn(
					'grid min-h-0 flex-1',
					!previewing && !inline && 'md:grid-cols-[minmax(18rem,2fr)_3fr]',
				)}
			>
				{/* Each list ends clear of the keyboard, so its last rows scroll up
				    into view. */}
				<div
					className={cn(
						// A grid item would grow to its longest row and push the
						// stars past the card's edge.
						'min-w-0',
						!inline && 'min-h-0 overflow-y-auto pb-(--keyboard-inset)',
						previewing && 'hidden',
					)}
				>
					<ul
						id={listboxId}
						role="listbox"
						aria-label="Ways to start and recipes"
						// Without a heading on top, a little room under the filters.
						className={cn('pb-3', sections.length < 2 && 'pt-1')}
					>
						{searching && online.results.length === 0 ? (
							<Status>
								{online.loading
									? 'looking for recipes…'
									: online.warming
										? 'finding recipes — more appear as sites load'
										: online.failed
											? "couldn't search recipes — try again"
											: !trimmed
												? 'no recipes rated that high yet'
												: options.length === 0 || options[0]?.kind === 'write'
													? 'no recipes called that yet'
													: 'no other recipes called that yet'}
							</Status>
						) : null}
						{/* Before anything has come back, rows to come stand in for
						    them, so the list never sits blank. */}
						{options.length === 0 &&
						(searching ? online.loading : popular.isPending) ? (
							<LoadingRows />
						) : null}
						{options.length === 0 && pool.length > 0 ? (
							<Status>nothing here matches these filters</Status>
						) : null}
						{sections.map(({ label, from, to }) => (
							<SectionRows
								key={label || options[from]?.kind}
								// A list alone needs no name; only side by side are lists
								// told apart.
								label={sections.length > 1 ? label : ''}
								options={options.slice(from, to)}
								from={from}
								busy={busy}
								optionProps={optionProps}
								recipeRowClassName={recipeRowClassName}
								showEffort={sort === 'effort'}
								save={
									inline
										? (recipe) => ({
												saved: isSaved(recipe),
												saving:
													busy ===
													`${optionKey({ kind: 'recipe', recipe })}:save`,
												toggle: () =>
													isSaved(recipe)
														? unsaveFound(recipe)
														: saveFound(recipe),
											})
										: undefined
								}
							/>
						))}
					</ul>
					{listable > visibleRecipes ? (
						inline && visibleRecipes < scrollsOnTo ? (
							// Laid flat in a page, the list goes on as it is scrolled,
							// for a while; then going on is a choice.
							<MoreAsScrolled
								onMore={() => setVisibleRecipes((count) => count + foundLimit)}
							/>
						) : (
							<button
								type="button"
								onClick={() => setVisibleRecipes((count) => count + foundLimit)}
								className="text-muted-foreground mx-2 mb-3 min-h-11 rounded-md px-3 text-sm font-semibold underline underline-offset-4"
							>
								show more recipes
							</button>
						)
					) : null}
					{error ? (
						<div className="px-4 pb-4">
							<FieldError>{error}</FieldError>
						</div>
					) : null}
				</div>
				{/* Laid flat in a page, a recipe opens its own page, so the list
				    has no preview beside it to fill. */}
				{inline ? null : (
					<div
						className={cn(
							'border-border min-h-0 flex-col overflow-hidden',
							!previewing && 'md:flex md:border-l',
							previewing ? 'flex' : 'hidden',
						)}
					>
						{previewing && error ? (
							<div className="px-4 py-2">
								<FieldError>{error}</FieldError>
							</div>
						) : null}
						<div
							ref={previewRef}
							data-previewing={previewing || undefined}
							className="min-h-0 flex-1 overflow-y-auto pb-(--keyboard-inset)"
						>
							<Preview
								option={current}
								idOf={idOf}
								actions={previewing ? actions : undefined}
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
					</div>
				)}
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
	recipeRowClassName,
	save,
	showEffort,
}: {
	label: string
	options: Option[]
	from: number
	busy: string | undefined
	optionProps: (index: number, option: Option) => object
	recipeRowClassName: (index: number) => string
	// Laid flat on home, each row saves from where it is.
	save?: ((recipe: FoundRecipe) => RowSave) | undefined
	// While the list is ordered by effort, each row says its own.
	showEffort: boolean
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
							<RecipeRow
								recipe={recipe}
								note={recipeNote(recipe)}
								save={save?.(recipe)}
								showEffort={showEffort}
							/>
						</li>
					)
				}

				if (option.kind === 'link')
					return (
						<li
							key="link"
							{...optionProps(index, option)}
							className={recipeRowClassName(index)}
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
							className={recipeRowClassName(index)}
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
	actions,
	looking,
	lookError,
}: {
	option: Option | undefined
	idOf: (recipe: FoundRecipe) => string | undefined
	actions: React.ReactNode
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
			// A site page keeps its address once it is brought in, so the preview
			// isn't drawn anew (and focus isn't lost) when it gets an id.
			key={recipe.url ?? id}
			recipe={recipe}
			recipeId={id}
			actions={actions}
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
	actions,
	looking,
	lookError,
}: {
	recipe: FoundRecipe
	recipeId: string | undefined
	actions: React.ReactNode
	looking: boolean
	lookError: string | undefined
}) {
	const full = useQuery({
		queryKey: ['recipe', recipeId],
		queryFn: () => getRecipe({ data: { id: recipeId ?? '' } }),
		enabled: recipeId !== undefined,
	})

	// The action a keyboard user was on while the recipe loaded. Loading swaps
	// the preview for the full reader, which draws the same actions anew, so
	// focus goes back to the one with the same name.
	const root = useRef<HTMLDivElement>(null)
	const focusedAction = useRef<string>(undefined)

	const loaded = !!full.data
	const [byKitchen, setByKitchen] = useState(true)

	useLayoutEffect(() => {
		const name = focusedAction.current

		if (!loaded || !name || root.current?.contains(document.activeElement))
			return

		const again = [...(root.current?.querySelectorAll('button, a') ?? [])].find(
			(action) => action.textContent?.trim() === name,
		)

		if (again instanceof HTMLElement) again.focus()
	}, [loaded])

	const remember = (event: React.FocusEvent) => {
		focusedAction.current = event.target.textContent?.trim() || undefined
	}

	if (full.data)
		return (
			<div ref={root} onFocus={remember} className="p-4 md:p-6">
				<RecipeReader
					recipe={full.data}
					heading="h2"
					actions={actions ? <div className="mt-5">{actions}</div> : null}
					// Looked at from a search, a recipe is read for the shop first:
					// what is home, what it needs, by where it comes from.
					ingredientsView={
						byKitchen ? (
							<ShopView
								recipeId={full.data.id}
								title={full.data.title}
								lines={full.data.ingredients}
							/>
						) : undefined
					}
					ingredientsAction={
						<button
							type="button"
							onClick={() => setByKitchen((now) => !now)}
							className="text-muted-foreground hover:text-foreground text-sm font-bold underline underline-offset-4 transition-colors"
						>
							{byKitchen ? 'as written' : 'by kitchen'}
						</button>
					}
				/>
			</div>
		)

	return (
		<div ref={root} onFocus={remember} className="flex flex-col gap-3 p-4">
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
					{actions}
				</div>
			</div>
			{recipeId === undefined && lookError ? (
				<p className="text-muted-foreground text-sm font-semibold">
					{lookError.replace(/\.$/, '')}.{' '}
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

// The end of a list that goes on: in sight, it asks for more.
function MoreAsScrolled({ onMore }: { onMore: () => void }) {
	const more = useRef(onMore)

	useEffect(() => {
		more.current = onMore
	})

	const watch = (node: HTMLDivElement | null) => {
		if (!node) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) more.current()
			},
			{ rootMargin: '400px 0px' },
		)

		observer.observe(node)

		return () => observer.disconnect()
	}

	return (
		<div
			ref={watch}
			aria-hidden
			className="text-muted-foreground px-4 pb-4 text-sm font-semibold"
		>
			more recipes…
		</div>
	)
}

// How the list is ordered, said quietly above it: "sort by" opens the two
// ways to; once one is picked it says so, with a cross to go back to the
// best match.
// Every filter, in the row's order, by the name and mark its bubble has.
const filterKeys = ['type', 'temp', 'cuisine', 'protein', 'site'] as const

type FilterKey = (typeof filterKeys)[number]

const filterLabels: Record<FilterKey, string> = {
	type: 'type',
	temp: 'temp',
	cuisine: 'country',
	protein: 'protein',
	site: 'site',
}

const filterGlyphs: Record<FilterKey, React.ReactNode> = {
	type: <ForkKnifeIcon size={14} weight="bold" aria-hidden />,
	temp: <ThermometerSimpleIcon size={14} weight="bold" aria-hidden />,
	...partGlyphs,
	site: <LinkSimpleIcon size={14} weight="bold" aria-hidden />,
}

function SortLine({
	sort,
	onSort,
}: {
	sort: FinderSort | undefined
	onSort: (sort: FinderSort | undefined) => void
}) {
	const named = (each: FinderSort) => (each === 'loved' ? 'rating' : each)

	const mark = (each: FinderSort) =>
		each === 'votes' ? (
			<UsersThreeIcon size={16} weight="bold" aria-hidden />
		) : each === 'effort' ? (
			<GaugeIcon size={16} weight="bold" aria-hidden />
		) : (
			<StarIcon
				size={16}
				weight="fill"
				aria-hidden
				className="text-kitchen-yolk"
			/>
		)

	return (
		<div className="text-muted-foreground flex min-h-9 shrink-0 items-center gap-1 text-sm font-semibold">
			<Menu.Root>
				<Menu.Trigger
					className={cn(
						'hover:text-foreground hover:bg-muted/60 data-popup-open:bg-muted inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 transition-colors',
						sort && 'text-foreground',
					)}
				>
					<ArrowsDownUpIcon size={14} weight="bold" aria-hidden />
					sort by{sort ? ` ${named(sort)}` : ''}
					<CaretDownIcon size={12} weight="bold" aria-hidden />
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Positioner
						className="z-50"
						side="bottom"
						align="end"
						sideOffset={6}
					>
						<Menu.Popup className="floating bg-background w-44 py-1 outline-none">
							{finderSorts.map((each) => (
								<Menu.Item
									key={each}
									onClick={() => onSort(each)}
									className="data-highlighted:bg-kitchen-yolk/40 flex w-full cursor-default items-center gap-3 px-3 py-2.5 text-sm font-semibold outline-none select-none"
								>
									{mark(each)}
									<span className="flex-1">{named(each)}</span>
									{sort === each ? (
										<CheckIcon size={14} weight="bold" aria-hidden />
									) : null}
								</Menu.Item>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			{sort ? (
				<button
					type="button"
					aria-label="stop sorting"
					onClick={() => onSort(undefined)}
					className="hover:text-foreground hover:bg-muted grid size-8 place-items-center rounded-full transition-colors"
				>
					<XIcon size={14} weight="bold" aria-hidden />
				</button>
			) : null}
		</div>
	)
}

type RowSave = Pick<
	React.ComponentProps<typeof SaveChip>,
	'saved' | 'saving' | 'toggle'
>

// A found recipe: a picture big enough to know the dish by, with a bookmark
// on its corner; its name, and at the right how it was rated; where it is
// from; then one line, read from the left so it lines up down the list, of
// what it asks of the cook, opening in place to say why; and tags for where
// it is from, what part of a meal it is, and whether it is meat-free.

function RecipeRow({
	recipe,
	note,
	save,
	showEffort,
}: {
	recipe: FoundRecipe
	note: string
	save?: RowSave | undefined
	showEffort: boolean
}) {
	const { stock, rating } = recipe

	return (
		<>
			<span className="relative shrink-0 self-start">
				<RecipeThumb
					imageUrl={recipe.imageUrl}
					title={recipe.title}
					glyphSize={40}
					className={cn(
						'size-18 rounded-xl md:size-28',
						recipe.recipeId && tileColors[tileColorFor(recipe.recipeId)],
					)}
				/>
				{save ? <SaveChip title={recipe.title} {...save} /> : null}
			</span>
			<span className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-3 gap-y-1 self-start">
				<span className="truncate text-base font-bold lowercase md:text-lg">
					{recipe.title}
				</span>
				{/* The stars and the effort lead, at the row's right, lined up
				    down the list. */}
				<RatingAndEffort
					rating={rating}
					effort={showEffort ? recipe.effort : undefined}
					buy={stock?.total ? stock.need.length : undefined}
				/>
				{note ? (
					<span className="text-muted-foreground col-start-1 truncate text-sm font-semibold lowercase md:text-base">
						{note}
					</span>
				) : null}
				<RecipeTags
					title={recipe.title}
					tags={recipe.tags}
					vegetarian={recipe.effort?.vegetarian ?? false}
					vegan={recipe.effort?.vegan}
					oneLine
					className="col-start-1"
				/>
			</span>
		</>
	)
}

// How a recipe was rated, as the row's lead figure: the stars large, and how
// many gave them small beneath, so the stars line up down a list whatever
// the count.
function RatingBlock({ rating }: { rating: { value: number; count: number } }) {
	return (
		<span
			aria-label={`rated ${rating.value.toFixed(1)} by ${rating.count}`}
			className="flex flex-col items-end tabular-nums"
		>
			<span className="inline-flex items-center gap-1 text-base font-bold md:text-lg">
				<StarIcon
					size={14}
					weight="fill"
					className="text-kitchen-yolk"
					aria-hidden
				/>
				{rating.value.toFixed(1)}
			</span>
			<span className="text-muted-foreground text-xs font-semibold md:text-sm">
				{compactCount(rating.count)} {rating.count === 1 ? 'vote' : 'votes'}
			</span>
		</span>
	)
}

// Where a recipe has no stars yet: a dashed star, for what isn't real yet,
// and no votes, so every row's stars sit in the same place.
function NoRating() {
	return (
		<span
			aria-label="not rated yet"
			className="text-muted-foreground flex flex-col items-end tabular-nums"
		>
			<span className="inline-flex items-center gap-1 text-base font-bold md:text-lg">
				<svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
					<path
						d="m8 1.5 2 4.3 4.6.5-3.4 3.1 1 4.6L8 11.7 3.8 14l1-4.6L1.4 6.3 6 5.8z"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.3"
						strokeDasharray="2 1.6"
						strokeLinejoin="round"
					/>
				</svg>
				0.0
			</span>
			<span className="text-xs font-semibold md:text-sm">0 votes</span>
		</span>
	)
}

// The row's right: how it was rated, and under it how much it asks, by a dot
// of basil, yolk or tomato. The recipe's page says why.
function RatingAndEffort({
	rating,
	effort,
	buy,
}: {
	rating: FoundRecipe['rating']
	effort: RecipeEffort | undefined
	buy: number | undefined
}) {
	const level = effort ? effortLevel(effort, buy) : undefined
	const tint = level ? effortTints.get(level) : undefined

	return (
		<span className="row-span-3 flex flex-col items-end gap-1">
			{rating ? <RatingBlock rating={rating} /> : <NoRating />}
			{level && tint ? (
				<span className="inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap md:text-sm">
					<span
						aria-hidden
						className={cn('size-2 shrink-0 rounded-full', tint.dot)}
					/>
					{level}
					<span className="max-md:sr-only">effort</span>
				</span>
			) : null}
		</span>
	)
}
