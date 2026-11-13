import {
	CarrotIcon,
	CookingPotIcon,
	HouseIcon,
	ShoppingCartIcon,
} from '@phosphor-icons/react'
import { Link, useMatches, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { AccountMenu, tabClassName } from '@/components/account-menu'
import { AddRecipeMenu } from '@/components/add-recipe-menu'
import { GroceryBadge, GroceryCount } from '@/components/grocery-badge'
import { useLastOpenedRecipe } from '@/lib/recipes/last-opened'
import { cn } from '@/lib/utils/ui'

const navItems = [
	{ label: 'home', icon: HouseIcon, to: '/' },
	{ label: 'recipes', icon: CookingPotIcon, to: '/recipes' },
	{ label: 'ingredients', icon: CarrotIcon, to: '/ingredients' },
	{ label: 'groceries', icon: ShoppingCartIcon, to: '/groceries' },
] as const

type TabBarMode = 'none' | 'bar' | 'bar-fab' | 'bar-own-fab'

// What a nav item does between a tap and the next page showing. It answers at
// once: pressed while the finger is down, then highlighted with a pulsing icon
// (the router marks the tapped link `data-transitioning` until the page is
// ready) so a slow load never reads as a dead tap.
const navFeedbackClassName =
	'group transition duration-100 active:bg-kitchen-yolk/50 motion-safe:active:scale-95 data-[transitioning=transitioning]:bg-kitchen-yolk/30'

const navIconFeedbackClassName =
	'group-data-[transitioning=transitioning]:animate-pulse motion-reduce:animate-none'

let hiders = 0

const hiderListeners = new Set<() => void>()

function subscribeToHiders(listener: () => void) {
	hiderListeners.add(listener)

	return () => hiderListeners.delete(listener)
}

// A screen that pins its own bottom actions calls this while they are showing.
export function useHideTabBar(hide: boolean) {
	useEffect(() => {
		if (!hide) return

		hiders++
		hiderListeners.forEach((listener) => listener())

		return () => {
			hiders--
			hiderListeners.forEach((listener) => listener())
		}
	}, [hide])
}

// Every page inside the app shell gets the tab bar. A route opts out, or adds
// the shelf's round button, with its `tabBar` static data; the deepest match
// decides. A screen that pins its own bottom actions only while editing calls
// useHideTabBar.
export function useTabBar(): TabBarMode {
	const matches = useMatches()

	const hidden = useSyncExternalStore(
		subscribeToHiders,
		() => hiders > 0,
		() => false,
	)

	if (!matches.some((match) => match.routeId === '/_app')) return 'none'

	let mode: 'none' | 'fab' | 'own-fab' | undefined

	for (const match of matches) mode = match.staticData?.tabBar ?? mode

	if (mode === 'none' || hidden) return 'none'

	if (mode === 'own-fab') return 'bar-own-fab'

	return mode === 'fab' ? 'bar-fab' : 'bar'
}

// The tab a page belongs to. Every shell page that is not another tab's (or
// settings) is a recipe's: a recipe from a site, a shared link or a published
// address lights up recipes like one on the shelf.
function useActiveTab(): (typeof navItems)[number]['label'] | undefined {
	const matches = useMatches()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	if (!matches.some((match) => match.routeId === '/_app')) return undefined

	if (pathname === '/settings') return undefined

	if (pathname === '/') return 'home'

	for (const { label } of navItems) {
		if (label === 'recipes' || label === 'home') continue

		if (pathname === `/${label}` || pathname.startsWith(`/${label}/`))
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
				to="/"
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
						to={to}
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
						{label === 'groceries' ? (
							<>
								<GroceryCount />
								<GroceryBadge className="ml-auto" />
							</>
						) : null}
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
				to="/"
				aria-label="cocochef"
				className="flex min-h-11 items-center gap-2 rounded-md text-sm font-bold"
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

function tabTarget(
	to: (typeof navItems)[number]['to'],
	lastRecipe: string | undefined,
) {
	if (to !== '/recipes') return { to } as const

	return lastRecipe
		? ({ to: '/recipes/$recipeId', params: { recipeId: lastRecipe } } as const)
		: ({ to: '/recipes' } as const)
}

// Thumb-reach navigation on phones: the two places you go. The recipes shelf
// adds one round action for its one job.
function TabBar() {
	const mode = useTabBar()
	const visible = useTabBarVisible()
	const lastRecipe = useLastOpenedRecipe()
	const tab = useActiveTab()

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
							{...tabTarget(to, !inRecipes ? lastRecipe : undefined)}
							aria-current={active ? 'page' : undefined}
							className={cn(
								tabClassName,
								navFeedbackClassName,
								active ? 'bg-kitchen-yolk/30' : 'hover:bg-card',
							)}
						>
							<span
								className={cn(
									'relative grid h-6 w-8 place-items-center',
									navIconFeedbackClassName,
								)}
							>
								<Icon
									size={22}
									weight={active ? 'fill' : 'regular'}
									aria-hidden
								/>
								{label === 'groceries' ? (
									<GroceryBadge className="bg-background absolute -top-1.5 -right-3" />
								) : null}
							</span>
							{label}
							{label === 'groceries' ? <GroceryCount /> : null}
						</Link>
					)
				})}
			</nav>
			{mode === 'bar-fab' ? (
				<AddRecipeMenu
					side="top"
					iconSize={26}
					className="bg-kitchen-yolk bottom-fab fixed right-4 z-20 grid size-14 place-items-center rounded-full shadow-md transition-colors hover:brightness-95 md:hidden"
				/>
			) : null}
		</>
	)
}
