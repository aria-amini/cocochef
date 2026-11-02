import { ArrowLeft } from '@phosphor-icons/react'
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'

import { useRecipeActions } from '@/components/recipe-actions'
import { RecipeEditor } from '@/components/recipe-editor'

const newRecipeSearch = z.object({
	// A name carried over from the shelf search.
	title: z.string().max(2000).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/recipes/new')({
	validateSearch: newRecipeSearch,
	component: NewRecipe,
})

// Writing your own starts on a blank recipe page. It is saved as a draft once
// it has a name, so leaving early keeps it on the shelf.
function NewRecipe() {
	const navigate = useNavigate()
	const { importLink } = useRecipeActions()
	const { title } = Route.useSearch()

	const pasted = useRouterState({
		select: (state) => state.location.state.pasted,
	})

	// The editor keeps what arrived; a reload must not sort it into a second
	// draft, so the page forgets it.
	useEffect(() => {
		if (pasted)
			void navigate({
				to: '/recipes/new',
				search: (prev) => prev,
				state: {},
				replace: true,
			})
	}, [pasted, navigate])

	return (
		<main className="flex-1">
			<div className="flex max-w-2xl flex-col gap-6 p-6 md:p-10">
				<Link
					to="/recipes"
					className="text-muted-foreground/80 hover:text-foreground focus-visible:outline-kitchen-eggplant inline-flex items-center gap-1.5 self-start text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					<ArrowLeft size={14} weight="bold" aria-hidden />
					recipes
				</Link>
				<h1 className="sr-only">write a recipe</h1>
				<RecipeEditor
					onImportLink={importLink}
					defaultTitle={title?.slice(0, 120) ?? ''}
					pasted={pasted}
					onDone={(recipeId) =>
						void navigate({ to: '/recipes/$recipeId', params: { recipeId } })
					}
				/>
			</div>
		</main>
	)
}
