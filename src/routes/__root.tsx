import { CheckCircleIcon } from '@phosphor-icons/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { useTabBarVisible } from '@/components/app-nav'
import { queryClient } from '@/lib/utils/query'

import appCss from '../styles.css?url'

// Clears the tab bar, which shows below the md breakpoint. Sonner's own mobile
// offset stops at 600px, so the desktop offset is put back from md up in
// styles.css.
const tabBarOffset = 'calc(5rem + env(safe-area-inset-bottom))'

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1, viewport-fit=cover',
			},
			{ title: 'cocochef' },
			{
				name: 'description',
				content:
					'every recipe you love, on one shelf. find a recipe, save it, and cook from one clean page.',
			},
			{ property: 'og:title', content: 'cocochef' },
			{
				property: 'og:description',
				content: 'every recipe you love, on one shelf.',
			},
		],
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
			{
				rel: 'icon',
				type: 'image/png',
				href: '/icon-192.png',
				sizes: '192x192',
			},
			{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
		],
	}),
	component: RootComponent,
})

function RootComponent() {
	const tabBar = useTabBarVisible()

	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<Outlet />
				</QueryClientProvider>
				<Toaster
					position="top-right"
					{...(tabBar && {
						offset: { bottom: tabBarOffset },
						mobileOffset: { bottom: tabBarOffset },
					})}
					// Done is said with a small check, not a green slab; only a
					// failure is loud.
					icons={{
						success: (
							<CheckCircleIcon
								size={18}
								weight="fill"
								aria-hidden
								className="text-kitchen-basil shrink-0"
							/>
						),
					}}
					toastOptions={{
						unstyled: true,
						classNames: {
							toast:
								'floating bg-card text-foreground font-sans flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold overflow-hidden',
							error: 'bg-kitchen-tomato text-foreground',
							// Undo is a button to reach for, not a word in the line.
							actionButton:
								'border-input hover:bg-muted/60 ml-auto min-h-9 shrink-0 rounded-md border px-3 text-sm font-semibold transition-colors',
						},
					}}
				/>
				<Scripts />
			</body>
		</html>
	)
}
