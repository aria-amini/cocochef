import {
	CarrotIcon,
	CookingPotIcon,
	PlusIcon,
	ShoppingCartIcon,
} from '@phosphor-icons/react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AccountMenu, tabClassName } from '@/components/account-menu'
import { useRecipeActions } from '@/components/recipe-actions'
import { cn } from '@/lib/utils/ui'

const navItems = [
	{ label: 'recipes', icon: CookingPotIcon, to: '/recipes' },
	{ label: 'ingredients', icon: CarrotIcon, to: '/ingredients' },
	{ label: 'groceries', icon: ShoppingCartIcon, to: '/groceries' },
] as const

// Screens that own their bottom edge (forms and the cooking view pin their own
// actions) leave the tab bar out; the rest of the app shows it.
const tabBarRoutes = new Set([
	'/recipes',
	'/ingredients',
	'/groceries',
	'/settings',
])

type TabBarMode = 'none' | 'bar' | 'bar-fab'

// The round add button belongs to the recipes shelf alone.
export function useTabBar(): TabBarMode {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const path = pathname.replace(/\/$/, '') || '/'

	if (path === '/recipes') return 'bar-fab'

	return tabBarRoutes.has(path) || path.startsWith('/coming-soon/')
		? 'bar'
		: 'none'
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
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	return (
		<nav
			aria-label="Primary"
			className="border-foreground/20 bg-background sticky top-0 hidden h-dvh w-48 shrink-0 flex-col items-stretch gap-1.5 border-r px-3 py-6 md:flex"
		>
			<Link
				to="/recipes"
				aria-label="dutch-oven"
				className="border-foreground/20 bg-card mb-6 flex w-full shrink-0 items-center justify-center gap-2 self-center rounded-md border px-3 py-2 text-sm font-bold whitespace-nowrap"
			>
				<img
					src="/icon-192.png"
					alt=""
					className="size-7 shrink-0 [image-rendering:pixelated]"
				/>
				dutch-oven
			</Link>
			{navItems.map(({ label, icon: Icon, to }) => {
				const active =
					pathname === to ||
					pathname.startsWith(`${to}/`) ||
					pathname === `/coming-soon/${label}`

				return (
					<Link
						key={to}
						to={to === '/recipes' ? '/recipes' : '/coming-soon/$feature'}
						params={to === '/recipes' ? {} : { feature: label }}
						aria-current={active ? 'page' : undefined}
						className={cn(
							'flex w-full shrink-0 items-center gap-2 border px-2.5 py-1.5 text-xs font-semibold rounded-md',
							active
								? 'border-foreground/15 bg-kitchen-yolk/30'
								: 'border-transparent hover:bg-card focus-visible:border-border',
						)}
					>
						<Icon size={18} weight={active ? 'fill' : 'regular'} aria-hidden />
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

	if (mode === 'none') return null

	return (
		<header className="flex items-center justify-between px-6 pt-3 md:hidden">
			<Link
				to="/recipes"
				aria-label="dutch-oven"
				className="flex items-center gap-2 rounded-md text-sm font-bold"
			>
				<img
					src="/icon-192.png"
					alt=""
					className="size-7 shrink-0 [image-rendering:pixelated]"
				/>
				dutch-oven
			</Link>
			<AccountMenu variant="avatar" />
		</header>
	)
}

// Thumb-reach navigation on phones: the two places you go. The recipes shelf
// adds one round action for its one job.
function TabBar() {
	const mode = useTabBar()
	const visible = useTabBarVisible()
	const { find } = useRecipeActions()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	if (!visible) return null

	return (
		<>
			<nav
				aria-label="Primary"
				className="border-border bg-background pb-safe fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t md:hidden"
			>
				{navItems.map(({ label, icon: Icon, to }) => {
					const active =
						pathname === to ||
						pathname.startsWith(`${to}/`) ||
						pathname === `/coming-soon/${label}`

					return (
						<Link
							key={to}
							to={to === '/recipes' ? '/recipes' : '/coming-soon/$feature'}
							params={to === '/recipes' ? {} : { feature: label }}
							aria-current={active ? 'page' : undefined}
							className={cn(
								tabClassName,
								active ? 'bg-kitchen-yolk/30' : 'hover:bg-card',
							)}
						>
							<span aria-hidden className="grid size-8 place-items-center">
								<Icon size={22} weight={active ? 'fill' : 'regular'} />
							</span>
							{label}
						</Link>
					)
				})}
			</nav>
			{mode === 'bar-fab' ? (
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
