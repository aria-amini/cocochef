import { createFileRoute } from '@tanstack/react-router'

import { BackLink, PageTitle } from '@/components/page'
import { SharingProfileSettings } from '@/components/sharing-profile'

export const Route = createFileRoute('/_app/profile_/sharing')({
	component: SharingSettings,
})

function SharingSettings() {
	return (
		<main className="w-full max-w-2xl space-y-8 p-6 md:p-10">
			<div>
				<BackLink to="/profile" className="mb-2">
					profile
				</BackLink>
				<PageTitle>sharing recipes</PageTitle>
				<p className="text-muted-foreground mt-3 max-w-lg">
					make a little recipe collection for the people you cook with.
				</p>
			</div>
			<SharingProfileSettings />
		</main>
	)
}
