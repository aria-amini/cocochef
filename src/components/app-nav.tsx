import {
	CookingPotIcon,
	HouseIcon,
	JarLabelIcon,
	ShoppingCartIcon,
} from '@phosphor-icons/react'
import { Link, useMatches, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { AccountMenu, tabClassName } from '@/components/account-menu'
import { GroceryCount, GroceryTabIcon } from '@/components/grocery-badge'
import { markTabJump } from '@/lib/kept-match'
import { useScrollHidden } from '@/lib/use-scroll-reveal'
import { cn } from '@/lib/utils/ui'

// Each tab's key is its path's name; the name on it says whose recipes the
// shelf holds, since home finds new ones.
const navItems = [
	{ label: 'home', name: 'home', icon: HouseIcon, to: '/' },
	{
		label: 'recipes',
		name: 'my recipes',
		icon: CookingPotIcon,
		to: '/recipes',
	},
	{
		label: 'groceries',
		name: 'groceries',
		icon: ShoppingCartIcon,
		to: '/groceries',
	},
	{ label: 'pantry', name: 'pantry', icon: JarLabelIcon, to: '/pantry' },
] as const

type TabBarMode = 'none' | 'bar' | 'bar-own-fab'

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

// Every page inside the app shell gets the tab bar. A route opts out, or makes
// room for a round button of its own, with its `tabBar` static data; the deepest match
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

	let mode: 'none' | 'own-fab' | undefined

	for (const match of matches) mode = match.staticData?.tabBar ?? mode

	if (mode === 'none' || hidden) return 'none'

	return mode === 'own-fab' ? 'bar-own-fab' : 'bar'
}

// The tab a recipe's page was opened from: home for one found there, my
// recipes for one off the shelf. A web recipe has one address however it was
// reached, so its address alone can't say. Kept in the browser only.
let openedFrom: 'home' | 'recipes' | undefined

// The tab a page belongs to. A recipe's page, wherever its address, lights
// the tab it was opened from; reached straight from a link, a recipe of the
// shelf's own (/recipes/…) lights my recipes and any other home.
function useActiveTab(): (typeof navItems)[number]['label'] | undefined {
	const matches = useMatches()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	useEffect(() => {
		if (pathname === '/') openedFrom = 'home'
		else if (pathname === '/recipes') openedFrom = 'recipes'
	}, [pathname])

	if (!matches.some((match) => match.routeId === '/_app')) return undefined

	if (pathname === '/settings') return undefined

	// Someone's public page belongs to no tab, yours included.
	if (matches.some((match) => match.routeId === '/_app/$handle/'))
		return undefined

	if (pathname === '/') return 'home'

	if (pathname === '/groceries') return 'groceries'

	if (pathname === '/pantry' || pathname.startsWith('/pantry/')) return 'pantry'

	if (pathname === '/recipes') return 'recipes'

	return openedFrom ?? (pathname.startsWith('/recipes/') ? 'recipes' : 'home')
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
					src="/logo.webp"
					alt=""
					width={96}
					height={96}
					className="size-7 shrink-0 rounded-md"
				/>
				cocochef
			</Link>
			{navItems.map(({ label, name, icon: Icon, to }) => {
				const active = tab === label

				return (
					<Link
						key={to}
						{...tabTarget(to, active)}
						aria-current={active ? 'page' : undefined}
						className={cn(
							navFeedbackClassName,
							'flex w-full shrink-0 items-center gap-2 border px-2.5 py-1.5 text-xs font-semibold rounded-md',
							active
								? 'border-foreground/15 bg-kitchen-yolk/30'
								: 'border-transparent hover:bg-card focus-visible:border-border',
						)}
					>
						{/* A grid, so the icon sits on no text line and the rows stay even. */}
						<span
							className={cn(
								'grid place-items-center',
								navIconFeedbackClassName,
							)}
						>
							{label === 'groceries' ? (
								<GroceryTabIcon
									icon={Icon}
									size={18}
									weight={active ? 'fill' : 'regular'}
								/>
							) : (
								<Icon
									size={18}
									weight={active ? 'fill' : 'regular'}
									aria-hidden
								/>
							)}
						</span>
						{name}
						{label === 'groceries' ? <GroceryCount /> : null}
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
	const hidden = useScrollHidden()

	// A page that leads with its own back bar has no use for the header.
	if (
		mode === 'none' ||
		matches.some((match) => match.staticData?.header === 'none')
	)
		return null

	return (
		// The same bar as a page's way back: the account in the same corner,
		// out of the way while reading down, back on the way up.
		<header
			className={cn(
				'border-border bg-background sticky top-[env(safe-area-inset-top,0px)] z-20 flex min-h-14 items-center justify-between border-b px-6 motion-safe:transition-transform md:hidden',
				hidden && '-translate-y-full',
			)}
		>
			<Link
				to="/"
				aria-label="cocochef"
				className="flex min-h-11 items-center gap-2 rounded-md text-sm font-bold"
			>
				<img
					src="/logo.webp"
					alt=""
					width={96}
					height={96}
					className="size-7 shrink-0 rounded-md"
				/>
				cocochef
			</Link>
			<AccountMenu variant="avatar" />
		</header>
	)
}

// A tab returns to where it was left, as a phone's tab bar does; tapped while
// it is already shown, it goes back to its top.
function tabTarget(to: (typeof navItems)[number]['to'], active: boolean) {
	return {
		to,
		resetScroll: false,
		onClick: () => {
			if (active) window.scrollTo({ top: 0, behavior: 'smooth' })
			else markTabJump()
		},
	} as const
}

// Thumb-reach navigation on phones: the two places you go.
function TabBar() {
	const visible = useTabBarVisible()
	const tab = useActiveTab()

	if (!visible) return null

	return (
		<>
			<nav
				aria-label="Primary"
				className="border-border bg-background pb-safe fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t md:hidden"
			>
				{navItems.map(({ label, name, icon: Icon, to }) => {
					const active = tab === label

					return (
						<Link
							key={to}
							{...tabTarget(to, active)}
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
								{label === 'groceries' ? (
									<GroceryTabIcon
										icon={Icon}
										size={22}
										weight={active ? 'fill' : 'regular'}
									/>
								) : (
									<Icon
										size={22}
										weight={active ? 'fill' : 'regular'}
										aria-hidden
									/>
								)}
							</span>
							{name}
							{label === 'groceries' ? <GroceryCount /> : null}
						</Link>
					)
				})}
			</nav>
		</>
	)
}
