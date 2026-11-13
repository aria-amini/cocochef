import { Link } from '@tanstack/react-router'

import { PageTitle } from '@/components/page'

export function RecipeAccessDenied() {
	return (
		<main className="flex flex-1 flex-col items-start gap-4 p-6 md:p-10">
			<PageTitle>you can’t open this recipe</PageTitle>
			<p className="text-muted-foreground max-w-lg">
				this recipe may be private or the link may no longer be available. if it
				belongs to you, sign in to the account that created it.
			</p>
			<Link to="/recipes" className="font-semibold underline">
				back to my recipes
			</Link>
		</main>
	)
}
