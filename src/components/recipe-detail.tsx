import { PencilSimple } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useHideTabBar } from '@/components/app-nav'
import { CopyRecipeButton } from '@/components/copy-recipe-button'
import { BackLink } from '@/components/page'
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
	const [editing, setEditing] = useState(recipe.owned && !recipe.finalizedAt)

	useHideTabBar(editing)

	useEffect(() => rememberRecipe(recipe.id), [recipe.id])

	return (
		<main
			className={cn(
				'bg-background text-foreground min-h-dvh min-w-0 flex-1 p-6 md:p-10',
			)}
		>
			<div className={cn(editing ? 'max-w-2xl' : 'max-w-5xl')}>
				{/* On phones this is a bar that stays put while the recipe scrolls. */}
				<div className="border-border bg-background sticky top-0 z-10 -mx-6 -mt-6 mb-4 border-b px-6 md:static md:m-0 md:mb-2 md:border-0 md:p-0">
					<BackLink to="/recipes">back to recipes</BackLink>
				</div>
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
