import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AppChrome } from '@/components/app-chrome'

export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
	return (
		<AppChrome>
			<Outlet />
		</AppChrome>
	)
}
