import { PencilSimple } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { CopyRecipeButton } from '@/components/copy-recipe-button'
import { BackLink } from '@/components/page'
import { RecipeEditor } from '@/components/recipe-editor'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeSharing } from '@/components/recipe-sharing'
import { SaveRecipeButton } from '@/components/save-recipe-button'
import { buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { getRecipe } from '@/lib/recipes/server'
import { getMyRecipeShare } from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

export type Recipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

// A recipe on its own page: read, cooked from, edited in place.
export function RecipeDetail({ recipe }: { recipe: Recipe }) {
	const navigate = useNavigate()
	// A recipe you are writing stays in the editor until it is finished.
	const [editing, setEditing] = useState(recipe.owned && !recipe.finalizedAt)

	return (
		<main
			className={cn(
				'bg-background text-foreground min-h-dvh min-w-0 flex-1 p-6 md:p-10',
				!editing && 'pb-tabbar md:pb-10',
			)}
		>
			<div className={cn(editing ? 'max-w-2xl' : 'max-w-5xl')}>
				<BackLink to="/recipes" className="mb-2">
					recipes
				</BackLink>
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
							<CopyRecipeButton recipeId={recipe.id} />
						)}

						{recipe.owned && recipe.finalizedAt ? (
							<RecipeSharing
								recipe={recipe}
								imported={!recipe.owned && !!recipe.sourceUrl}
							/>
						) : null}
					</div>
					{!recipe.owned ? (
						<p className="text-muted-foreground mt-2 text-sm">
							save keeps this recipe; make a copy to edit your own version.
						</p>
					) : null}
				</>
			}
		/>
	)
}
