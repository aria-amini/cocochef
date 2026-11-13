import {
	createFileRoute,
	useNavigate,
	useRouterState,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { AuthDialog } from '@/components/auth-dialog'
import { BackLink } from '@/components/page'
import { useRecipeActions } from '@/components/recipe-actions'
import { RecipeEditor } from '@/components/recipe-editor'
import { buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'

const newRecipeSearch = z.object({
	// A name carried over from the shelf search.
	title: z.string().max(2000).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/recipes/new')({
	// The form pins its own save bar to the bottom edge.
	staticData: { tabBar: 'none' },
	validateSearch: newRecipeSearch,
	component: NewRecipe,
})

// Writing your own starts on a blank page and is saved explicitly.
function NewRecipe() {
	const navigate = useNavigate()
	const session = authClient.useSession()
	const [authOpen, setAuthOpen] = useState(true)
	const { importLink } = useRecipeActions()
	const { title } = Route.useSearch()

	const pasted = useRouterState({
		select: (state) => state.location.state.pasted,
	})

	// OAuth navigates away from this page; session storage keeps a pending paste
	// in this tab until the signed-in editor has received it.
	const [pendingPaste, setPendingPaste] = useState(
		() =>
			pasted ??
			(typeof window === 'undefined'
				? undefined
				: (sessionStorage.getItem('recipe-paste') ?? undefined)),
	)

	useEffect(() => {
		if (!pasted) return
		sessionStorage.setItem('recipe-paste', pasted)
		// Keep newly delivered router state after replacing the history entry.
		// oxlint-disable-next-line react/set-state-in-effect
		setPendingPaste(pasted)
	}, [pasted])
	useEffect(() => {
		if (session.isPending || !session.data?.user || !pendingPaste) return
		sessionStorage.removeItem('recipe-paste')

		if (pasted)
			void navigate({
				to: '/recipes/new',
				search: (prev) => prev,
				state: {},
				replace: true,
			})
	}, [pendingPaste, pasted, navigate, session.isPending, session.data?.user])

	return (
		<main className="flex-1">
			<div className="flex max-w-2xl flex-col gap-6 p-6 md:p-10">
				<BackLink to="/recipes">my recipes</BackLink>
				<h1 className="sr-only">write a recipe</h1>
				{session.isPending ? null : !session.data?.user ? (
					<>
						<p>create an account to write your recipes.</p>
						<button
							type="button"
							className={buttonVariants({ className: 'self-start' })}
							onClick={() => setAuthOpen(true)}
						>
							create an account
						</button>
						<AuthDialog
							open={authOpen}
							onOpenChange={setAuthOpen}
							redirect="/recipes/new"
						/>
					</>
				) : (
					<RecipeEditor
						onImportLink={importLink}
						defaultTitle={title?.slice(0, 120) ?? ''}
						pasted={pendingPaste}
						onDone={(recipeId) =>
							void navigate({ to: '/recipes/$recipeId', params: { recipeId } })
						}
					/>
				)}
			</div>
		</main>
	)
}
