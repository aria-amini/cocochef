import { BookmarkSimpleIcon, PencilSimple } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	notFound,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { DeleteRecipeDialog } from '@/components/delete-recipe-dialog'
import { BackLink } from '@/components/page'
import { RecipeEditor } from '@/components/recipe-editor'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeSharing } from '@/components/recipe-sharing'
import { buttonVariants } from '@/components/ui/button'
import type { collections } from '@/db/schema'
import {
	deleteRecipe,
	getRecipe,
	listBooks,
	moveRecipe,
	saveRecipe,
} from '@/lib/recipes/server'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/recipes/$recipeId')({
	loader: async ({ params }) => {
		const [recipe, books] = await Promise.all([
			getRecipe({ data: { id: params.recipeId } }),
			listBooks(),
		])

		if (!recipe) throw notFound()

		return { recipe, books }
	},
	component: RecipeDetail,
})

type Recipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

type Book = typeof collections.$inferSelect

function RecipeDetail() {
	const { recipe, books } = Route.useLoaderData()
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
							books={books}
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
	books,
	onEdit,
}: {
	recipe: Recipe
	books: Book[]
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
						{recipe.saved && books.length ? (
							<BookPicker recipe={recipe} books={books} />
						) : null}
					</div>
				</>
			}
		/>
	)
}

// A shared recipe someone opened from a search or a link. Saving it puts it on
// the shelf as is; books come after. Solid until it is saved. Once saved it
// says so, and pressing it asks before taking the recipe off the shelf.
function SaveButton({ recipe }: { recipe: Recipe }) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [pending, setPending] = useState(false)
	const [confirming, setConfirming] = useState(false)

	const save = async () => {
		setPending(true)

		try {
			if (recipe.saved) await deleteRecipe({ data: { id: recipe.id } })
			else await saveRecipe({ data: { id: recipe.id } })
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

function BookPicker({ recipe, books }: { recipe: Recipe; books: Book[] }) {
	const router = useRouter()
	const [pending, setPending] = useState(false)

	const move = async (collectionId: string) => {
		setPending(true)

		try {
			await moveRecipe({
				data: { id: recipe.id, collectionId: collectionId || null },
			})
			await router.invalidate()
		} catch {
			toast.error("couldn't move that — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="flex items-center gap-2">
			<label htmlFor="recipe-book" className="text-xs font-semibold">
				book
			</label>
			<select
				id="recipe-book"
				value={recipe.collectionId ?? ''}
				disabled={pending}
				onChange={(event) => void move(event.target.value)}
				className="border-input bg-card focus-visible:outline-kitchen-eggplant rounded-md border px-2 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
			>
				<option value="">no book</option>
				{books.map((book) => (
					<option key={book.id} value={book.id}>
						{book.name}
					</option>
				))}
			</select>
		</div>
	)
}
