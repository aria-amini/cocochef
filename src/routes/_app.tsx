import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AppNav, useTabBar } from '@/components/app-nav'
import { NavigationProgress } from '@/components/navigation-progress'
import { RecipeActionsProvider } from '@/components/recipe-actions'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
	const tabBar = useTabBar()

	return (
		<RecipeActionsProvider>
			<div
				className={cn(
					'bg-background text-foreground flex min-h-dvh flex-col md:flex-row md:pb-0',
					tabBar === 'bar' && 'pb-tabbar',
					tabBar === 'bar-fab' && 'pb-tabbar-fab',
				)}
			>
				<NavigationProgress />
				<AppNav />
				<Outlet />
			</div>
		</RecipeActionsProvider>
	)
}
