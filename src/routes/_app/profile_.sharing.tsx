import { createFileRoute, Link } from '@tanstack/react-router'

import { SharingProfileSettings } from '@/components/sharing-profile'

export const Route = createFileRoute('/_app/profile_/sharing')({
	component: SharingSettings,
})

function SharingSettings() {
	return (
		<main className="w-full max-w-2xl space-y-8 p-6 md:p-10">
			<Link to="/profile" className="text-sm font-semibold underline">
				back to profile
			</Link>
			<div>
				<h1 className="text-3xl font-bold tracking-tight">sharing recipes</h1>
				<p className="text-muted-foreground mt-3 max-w-lg">
					make a little recipe collection for the people you cook with.
				</p>
			</div>
			<SharingProfileSettings />
		</main>
	)
}
