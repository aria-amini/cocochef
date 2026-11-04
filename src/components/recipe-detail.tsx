import { BookmarkSimpleIcon, PencilSimple } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { DeleteRecipeDialog } from '@/components/delete-recipe-dialog'
import { BackLink } from '@/components/page'
import { RecipeEditor } from '@/components/recipe-editor'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeSharing } from '@/components/recipe-sharing'
import { buttonVariants } from '@/components/ui/button'
import { deleteRecipe, getRecipe, saveRecipe } from '@/lib/recipes/server'
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
	return (
		<RecipeReader
			recipe={recipe}
			actions={
				<>
					<div className="mt-6 flex flex-wrap items-center gap-2">
						{recipe.owned ? null : <SaveButton recipe={recipe} />}
						<button
							type="button"
							className={buttonVariants({
								variant: recipe.owned || recipe.saved ? 'default' : 'outline',
							})}
							onClick={onEdit}
						>
							<PencilSimple size={14} weight="bold" aria-hidden />
							edit
						</button>
						{recipe.finalizedAt ? (
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

// A shared recipe someone opened from a search or a link. Saving it puts it on
// the shelf as is. Solid until it is saved. Once saved it
// says so, and pressing it asks before taking the recipe off the shelf.
function SaveButton({ recipe }: { recipe: Recipe }) {
	const router = useRouter()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const [pending, setPending] = useState(false)
	const [confirming, setConfirming] = useState(false)

	const save = async () => {
		setPending(true)

		try {
			if (recipe.saved) {
				await deleteRecipe({ data: { id: recipe.id } })
				// This cook's own readable address went with the recipe; the id address
				// still opens it.
				await navigate({
					to: '/recipes/$recipeId',
					params: { recipeId: recipe.id },
					replace: true,
				})
			} else await saveRecipe({ data: { id: recipe.id } })

			await Promise.all([
				router.invalidate(),
				queryClient.invalidateQueries({ queryKey: ['shelf'] }),
				queryClient.invalidateQueries({ queryKey: ['recipe', recipe.id] }),
			])
			setConfirming(false)
			toast.success(
				recipe.saved
					? 'removed from your shelf'
					: `${recipe.title} is on your shelf`,
			)
		} catch {
			toast.error("couldn't update your shelf — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="contents">
			<button
				type="button"
				disabled={pending}
				onClick={() => (recipe.saved ? setConfirming(true) : void save())}
				className={buttonVariants({
					variant: recipe.saved ? 'outline' : 'default',
				})}
			>
				<BookmarkSimpleIcon
					size={14}
					weight={recipe.saved ? 'fill' : 'bold'}
					aria-hidden
					className="size-3.5"
				/>
				{recipe.saved ? 'saved' : 'save'}
			</button>
			<DeleteRecipeDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={recipe.title}
				shared
				pending={pending}
				onConfirm={() => void save()}
			/>
		</div>
	)
}
