import {
	CarrotIcon,
	CookingPotIcon,
	PlusIcon,
	ShoppingCartIcon,
} from '@phosphor-icons/react'
import { Link, useMatches, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { AccountMenu, tabClassName } from '@/components/account-menu'
import { useRecipeActions } from '@/components/recipe-actions'
import { useLastOpenedRecipe } from '@/lib/recipes/last-opened'
import { cn } from '@/lib/utils/ui'

const navItems = [
	{ label: 'recipes', icon: CookingPotIcon, to: '/recipes' },
	{ label: 'ingredients', icon: CarrotIcon, to: '/ingredients' },
	{ label: 'groceries', icon: ShoppingCartIcon, to: '/groceries' },
] as const

type TabBarMode = 'none' | 'bar' | 'bar-fab'

// What a nav item does between a tap and the next page showing. It answers at
// once: pressed while the finger is down, then highlighted with a pulsing icon
// (the router marks the tapped link `data-transitioning` until the page is
// ready) so a slow load never reads as a dead tap.
const navFeedbackClassName =
	'group transition duration-100 active:bg-kitchen-yolk/50 motion-safe:active:scale-95 data-[transitioning=transitioning]:bg-kitchen-yolk/30'

const navIconFeedbackClassName =
	'group-data-[transitioning=transitioning]:animate-pulse motion-reduce:animate-none'

// A count of the screens asking to hide something, readable during render.
function createHiders() {
	let hiders = 0

	const listeners = new Set<() => void>()

	const notify = () => listeners.forEach((listener) => listener())

	function useHide(hide: boolean) {
		useEffect(() => {
			if (!hide) return

			hiders++
			notify()

			return () => {
				hiders--
				notify()
			}
		}, [hide])
	}

	function useHidden() {
		return useSyncExternalStore(
			(listener) => {
				listeners.add(listener)

				return () => listeners.delete(listener)
			},
			() => hiders > 0,
			() => false,
		)
	}

	return { useHide, useHidden }
}

const tabBarHiders = createHiders()

const addButtonHiders = createHiders()

// A screen that pins its own bottom actions calls this while they are showing.
export const useHideTabBar = tabBarHiders.useHide

// A screen whose own content is the way to add a recipe calls this, so the round
// button doesn't repeat it or cover that content.
export const useHideAddButton = addButtonHiders.useHide

// Every page inside the app shell gets the tab bar. A route opts out, or adds
// the shelf's round button, with its `tabBar` static data; the deepest match
// decides. A screen that pins its own bottom actions only while editing calls
// useHideTabBar.
export function useTabBar(): TabBarMode {
	const matches = useMatches()

	const hidden = tabBarHiders.useHidden()

	if (!matches.some((match) => match.routeId === '/_app')) return 'none'

	let mode: 'none' | 'fab' | undefined

	for (const match of matches) mode = match.staticData?.tabBar ?? mode

	if (mode === 'none' || hidden) return 'none'

	return mode === 'fab' ? 'bar-fab' : 'bar'
}

// The tab a page belongs to. Recipes is the app's home, so every shell page that
// is not another tab's (or settings) counts as one: a recipe from a site, a
// shared link or a published address lights it up like one on the shelf.
function useActiveTab(): (typeof navItems)[number]['label'] | undefined {
	const matches = useMatches()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	if (!matches.some((match) => match.routeId === '/_app')) return undefined

	if (pathname === '/settings') return undefined

	for (const { label } of navItems) {
		if (label === 'recipes') continue

		if (
			pathname === `/${label}` ||
			pathname.startsWith(`/${label}/`) ||
			pathname === `/coming-soon/${label}`
		)
			return label
	}

	return 'recipes'
}

// The on-screen keyboard shoves fixed bars up over the field being typed in,
// so the tab bar steps aside while a text field has focus.
function useTyping() {
	const [typing, setTyping] = useState(false)

	useEffect(() => {
		const update = () =>
			setTimeout(
				() =>
					setTyping(
						document.activeElement?.matches(
							'textarea, select, input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=file])',
						) ?? false,
					),
				0,
			)

		document.addEventListener('focusin', update)
		document.addEventListener('focusout', update)

		return () => {
			document.removeEventListener('focusin', update)
			document.removeEventListener('focusout', update)
		}
	}, [])

	return typing
}

// Whether the tab bar is on screen, for what has to sit above it.
export function useTabBarVisible() {
	const mode = useTabBar()
	const typing = useTyping()

	return mode !== 'none' && !typing
}

export function AppNav() {
	return (
		<>
			<MobileHeader />
			<Sidebar />
			<TabBar />
		</>
	)
}

function Sidebar() {
	const tab = useActiveTab()

	return (
		<nav
			aria-label="Primary"
			className="border-foreground/20 bg-background sticky top-0 hidden h-dvh w-48 shrink-0 flex-col items-stretch gap-1.5 border-r px-3 py-6 md:flex"
		>
			<Link
				to="/recipes"
				aria-label="cocochef"
				className="mb-6 flex w-full shrink-0 items-center gap-2 rounded-md border border-transparent py-2 text-sm font-bold whitespace-nowrap"
			>
				<img
					src="/icon-192.png"
					alt=""
					className="size-7 shrink-0 rounded-md"
				/>
				cocochef
			</Link>
			{navItems.map(({ label, icon: Icon, to }) => {
				const active = tab === label

				return (
					<Link
						key={to}
						to={to === '/recipes' ? '/recipes' : '/coming-soon/$feature'}
						params={to === '/recipes' ? {} : { feature: label }}
						aria-current={active ? 'page' : undefined}
						className={cn(
							navFeedbackClassName,
							'flex w-full shrink-0 items-center gap-2 border px-2.5 py-1.5 text-xs font-semibold rounded-md',
							active
								? 'border-foreground/15 bg-kitchen-yolk/30'
								: 'border-transparent hover:bg-card focus-visible:border-border',
						)}
					>
						<Icon
							size={18}
							weight={active ? 'fill' : 'regular'}
							aria-hidden
							className={navIconFeedbackClassName}
						/>
						{label}
					</Link>
				)
			})}
			<div className="mt-auto flex flex-col gap-4 pt-6">
				<AccountMenu variant="rail" />
			</div>
		</nav>
	)
}

// The account is a rare visit, so on phones it lives in a slim header instead of
// taking a tab.
function MobileHeader() {
	const mode = useTabBar()
	const matches = useMatches()

	// A page that leads with its own back bar has no use for the header.
	if (
		mode === 'none' ||
		matches.some((match) => match.staticData?.header === 'none')
	)
		return null

	return (
		<header className="flex items-center justify-between px-6 pt-3 md:hidden">
			<Link
				to="/recipes"
				aria-label="cocochef"
				className="flex items-center gap-2 rounded-md text-sm font-bold"
			>
				<img
					src="/icon-192.png"
					alt=""
					className="size-7 shrink-0 rounded-md"
				/>
				cocochef
			</Link>
			<AccountMenu variant="avatar" />
		</header>
	)
}

function tabTarget(to: string, label: string, lastRecipe: string | undefined) {
	if (to !== '/recipes')
		return { to: '/coming-soon/$feature', params: { feature: label } } as const

	return lastRecipe
		? ({ to: '/recipes/$recipeId', params: { recipeId: lastRecipe } } as const)
		: ({ to: '/recipes' } as const)
}

// Thumb-reach navigation on phones: the two places you go. The recipes shelf
// adds one round action for its one job.
function TabBar() {
	const mode = useTabBar()
	const visible = useTabBarVisible()
	const { find } = useRecipeActions()
	const lastRecipe = useLastOpenedRecipe()
	const tab = useActiveTab()
	const addHidden = addButtonHiders.useHidden()

	if (!visible) return null

	// Coming back from another tab reopens the recipe you were reading; from the
	// recipe itself, the tab goes up to the shelf.
	const inRecipes = tab === 'recipes'

	return (
		<>
			<nav
				aria-label="Primary"
				className="border-border bg-background pb-safe fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t md:hidden"
			>
				{navItems.map(({ label, icon: Icon, to }) => {
					const active = tab === label

					return (
						<Link
							key={to}
							{...tabTarget(to, label, !inRecipes ? lastRecipe : undefined)}
							aria-current={active ? 'page' : undefined}
							className={cn(
								tabClassName,
								navFeedbackClassName,
								active ? 'bg-kitchen-yolk/30' : 'hover:bg-card',
							)}
						>
							<span
								aria-hidden
								className={cn(
									'grid size-8 place-items-center',
									navIconFeedbackClassName,
								)}
							>
								<Icon size={22} weight={active ? 'fill' : 'regular'} />
							</span>
							{label}
						</Link>
					)
				})}
			</nav>
			{mode === 'bar-fab' && !addHidden ? (
				<button
					type="button"
					aria-label="add recipe"
					onClick={() => find()}
					className="bg-kitchen-yolk bottom-fab fixed right-4 z-20 grid size-14 place-items-center rounded-full shadow-md transition-colors hover:brightness-95 md:hidden"
				>
					<PlusIcon size={26} weight="bold" aria-hidden />
				</button>
			) : null}
		</>
	)
}
