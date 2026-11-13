import { AppNav, useTabBar } from '@/components/app-nav'
import { NavigationProgress } from '@/components/navigation-progress'
import { RecipeActionsProvider } from '@/components/recipe-actions'
import { cn } from '@/lib/utils/ui'

// The sidebar, tab bar and the one recipe box around a page, so a shared
// recipe sits in the same app as the shelf.
export function AppChrome({ children }: { children: React.ReactNode }) {
	const tabBar = useTabBar()

	return (
		<RecipeActionsProvider>
			<div
				className={cn(
					'bg-background text-foreground flex min-h-dvh flex-col md:flex-row md:pb-0',
					tabBar === 'bar' && 'pb-tabbar',
					(tabBar === 'bar-fab' || tabBar === 'bar-own-fab') && 'pb-tabbar-fab',
				)}
			>
				<NavigationProgress />
				<AppNav />
				{children}
			</div>
		</RecipeActionsProvider>
	)
}
