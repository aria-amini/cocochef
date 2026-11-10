import { PencilSimple } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useHideTabBar } from '@/components/app-nav'
import { EditSharedButton } from '@/components/edit-shared-button'
import { BackBar, BackLink } from '@/components/page'
import { RecipeEditor } from '@/components/recipe-editor'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeSharing } from '@/components/recipe-sharing'
import { SaveRecipeButton } from '@/components/save-recipe-button'
import { buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { rememberRecipe } from '@/lib/recipes/last-opened'
import { getRecipe } from '@/lib/recipes/server'
import { getMyRecipeShare } from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

export type Recipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

// A recipe on its own page: read, cooked from, edited in place.
export function RecipeDetail({ recipe }: { recipe: Recipe }) {
	const navigate = useNavigate()

	// A recipe you are writing stays in the editor until it is finished.
	const editRequested = useRouterState({
		select: (state) => state.location.state.editing === true,
	})

	// Someone else's recipe opens in the editor only when asked; saving a change
	// there makes the cook's own copy.
	const [editing, setEditing] = useState(
		(recipe.owned && !recipe.finalizedAt) || editRequested,
	)

	useHideTabBar(editing)

	useEffect(() => rememberRecipe(recipe.id), [recipe.id])

	return (
		<main
			className={cn(
				'bg-background text-foreground min-h-dvh min-w-0 flex-1 p-6 md:p-10',
			)}
		>
			<div className={cn(editing ? 'max-w-2xl' : 'max-w-5xl')}>
				<BackBar>
					<BackLink to="/recipes">back to recipes</BackLink>
				</BackBar>
				{editing ? (
					<>
						<RecipeEditor
							key={recipe.id}
							recipe={recipe}
							onDone={(recipeId) => {
								// Moving to the copy must not leave the editor open there.
								setEditing(false)

								if (recipeId !== recipe.id)
									void navigate({
										to: '/recipes/$recipeId',
										params: { recipeId },
									})
							}}
						/>
					</>
				) : (
					<>
						<RecipeView
							key={recipe.id}
							recipe={recipe}
							onEdit={() => {
								setEditing(true)
							}}
						/>
					</>
				)}
			</div>
		</main>
	)
}

function RecipeView({
	recipe,
	onEdit,
}: {
	recipe: Recipe
	onEdit: () => void
}) {
	const account = authClient.useSession().data?.user

	const share = useQuery({
		queryKey: ['recipe-share', account?.id, recipe.id],
		queryFn: () => getMyRecipeShare({ data: { id: recipe.id } }),
		enabled: recipe.owned && !!account && !account.isAnonymous,
	})

	return (
		<RecipeReader
			recipe={recipe}
			status={{
				saved: recipe.saved && !recipe.owned,
				visibility: recipe.owned
					? (share.data?.visibility ?? recipe.visibility) === 'public'
						? 'public'
						: 'private'
					: undefined,
			}}
			authorship={
				recipe.originalAuthorName
					? `copied from ${recipe.originalAuthorName}`
					: recipe.authorName
						? `created by ${recipe.authorName}`
						: undefined
			}
			actions={
				<>
					<div className="mt-6 flex flex-wrap items-center gap-2">
						{!recipe.owned ? <SaveRecipeButton recipe={recipe} /> : null}
						{recipe.owned ? (
							<button
								type="button"
								className={buttonVariants({ variant: 'outline' })}
								onClick={onEdit}
							>
								<PencilSimple size={14} weight="bold" aria-hidden /> edit
							</button>
						) : (
							<EditSharedButton recipeId={recipe.id} onEdit={onEdit} />
						)}

						{recipe.owned && recipe.finalizedAt ? (
							<RecipeSharing
								recipe={recipe}
								imported={!recipe.owned && !!recipe.sourceUrl}
							/>
						) : null}
					</div>
				</>
			}
		/>
	)
}
