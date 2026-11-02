import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AppNav, useTabBar } from '@/components/app-nav'
import { useActiveCooking } from '@/components/cooking-tracker'
import { NavigationProgress } from '@/components/navigation-progress'
import { RecipeActionsProvider } from '@/components/recipe-actions'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
	const tabBar = useTabBar()
	const cooking = useActiveCooking()

	return (
		<RecipeActionsProvider>
			<div
				className={cn(
					'bg-background text-foreground flex min-h-dvh flex-col md:flex-row md:pb-0',
					tabBar === 'bar' && 'pb-tabbar',
					tabBar === 'bar-fab' && 'pb-tabbar-fab',
					!!cooking.data?.length && 'pb-64',
				)}
			>
				<NavigationProgress />
				<AppNav />
				<Outlet />
			</div>
		</RecipeActionsProvider>
	)
}
