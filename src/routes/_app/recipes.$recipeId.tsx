import {
	BookmarkSimpleIcon,
	PencilSimple,
	UserCheckIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	notFound,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'

import { DeleteRecipeDialog } from '@/components/delete-recipe-dialog'
import { IngredientText } from '@/components/ingredient-text'
import { BackLink, PageTitle } from '@/components/page'
import { RecipeEditor } from '@/components/recipe-editor'
import { RecipeSharing } from '@/components/recipe-sharing'
import { buttonVariants } from '@/components/ui/button'
import type { collections } from '@/db/schema'
import { importSiteForUrl, importSiteLogo } from '@/lib/import/sites'
import { ingredientItemSprite } from '@/lib/pantry/sprites'
import { ingredientViewRows } from '@/lib/recipes/ingredient-groups'
import { formatMinutes } from '@/lib/recipes/model'
import {
	claimRecipe,
	deleteRecipe,
	getRecipe,
	listBooks,
	moveRecipe,
	saveRecipe,
} from '@/lib/recipes/server'
import { stepRows } from '@/lib/recipes/step-groups'
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

const sectionLabelClassName = 'text-lg font-semibold'

function hostOf(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return url
	}
}

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
						<EditTools recipe={recipe} />
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

// Ownership changes belong to editing, so the read view stays quiet.
function EditTools({ recipe }: { recipe: Recipe }) {
	return (
		<div className="mb-4 flex flex-wrap items-center gap-2 empty:hidden">
			{recipe.owned && (recipe.forkedFromId || recipe.sourceUrl) ? (
				<ClaimButton recipe={recipe} disabled={false} />
			) : null}
		</div>
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
	const [checked, setChecked] = useState<Set<string>>(() => new Set())

	const toggle = (item: string) =>
		setChecked((current) => {
			const next = new Set(current)

			if (next.has(item)) next.delete(item)
			else next.add(item)

			return next
		})

	const rows = ingredientViewRows(
		recipe.ingredients,
		false,
		recipe.ingredientCategories,
	)

	const RowBody = 'label'

	const stepBox = (
		text: string,
		index: number,
		label: string,
		nested = false,
	) => {
		const item = `s${index}`
		const done = checked.has(item)

		return (
			<RowBody
				className={cn(
					'flex min-h-11 cursor-pointer items-start gap-3',
					nested ? 'py-2' : 'py-2.5',
				)}
			>
				<input
					type="checkbox"
					aria-label={`step ${label}: ${text}`}
					checked={done}
					onChange={() => toggle(item)}
					className="accent-kitchen-basil mt-0.5 size-6 shrink-0"
				/>
				<span className="text-muted-foreground mt-1 w-5 shrink-0 text-sm font-semibold tabular-nums">
					{label}
				</span>
				<span
					className={cn(
						'text-base leading-relaxed',
						done && 'text-muted-foreground line-through',
					)}
				>
					{text}
				</span>
			</RowBody>
		)
	}

	return (
		<>
			<div className="flex items-start gap-4">
				{recipe.imageUrl ? (
					<img
						src={recipe.imageUrl}
						alt={recipe.title}
						className="border-border size-16 shrink-0 rounded-xl border object-cover md:size-24"
					/>
				) : null}
				<div className="min-w-0">
					<PageTitle className="text-2xl md:text-4xl">{recipe.title}</PageTitle>
					<RecipeMeta recipe={recipe} />
				</div>
			</div>
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
			<div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-12">
				<section>
					<div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
						<h2 className={sectionLabelClassName}>ingredients</h2>
					</div>

					<div className="mt-2">
						<table aria-label="ingredients" className="w-full">
							<tbody>
								{recipe.ingredients.length ? (
									rows.map((row) => {
										if (row.kind === 'heading')
											return (
												<tr key={row.key} className="border-border border-b">
													<th
														colSpan={1}
														scope="colgroup"
														className="pt-3 pb-2 text-left text-sm font-semibold"
													>
														{row.text}
													</th>
												</tr>
											)

										if (row.kind !== 'ingredient') return null
										const item = `i${row.index}`
										const id = `ingredient-${row.index}`
										const done = checked.has(item)
										const sprite = ingredientItemSprite(row.text)

										return (
											<tr
												key={row.key}
												className="border-border border-b align-top"
											>
												<td>
													<label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
														<input
															type="checkbox"
															id={id}
															aria-label={row.text}
															checked={done}
															onChange={() => toggle(item)}
															className="accent-kitchen-basil mt-1 size-6 shrink-0"
														/>
														<span
															className="mt-1 flex size-6 shrink-0 items-center justify-center"
															aria-hidden
														>
															{sprite ? (
																<img
																	src={`/sprites/pantry/${sprite}.png`}
																	alt=""
																	className="size-6 object-contain [image-rendering:pixelated]"
																/>
															) : null}
														</span>
														<IngredientText text={row.text} done={done} />
													</label>
												</td>
											</tr>
										)
									})
								) : (
									<tr>
										<td
											colSpan={1}
											className="border-foreground/40 border-dashed p-4 text-sm font-semibold"
										>
											no ingredients yet
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</section>
				<section>
					<div className="flex min-h-11 items-center">
						<h2 className={sectionLabelClassName}>steps</h2>
					</div>
					<ol className="mt-2">
						{recipe.steps.length ? (
							stepRows(recipe.steps).map((row) =>
								row.kind === 'group' ? (
									<li
										key={`${row.text}-${row.index}`}
										className="border-border border-b"
									>
										<p className="flex items-start gap-3 pt-3 pb-1">
											<span className="text-muted-foreground mt-1 ml-9 w-5 shrink-0 text-sm font-semibold tabular-nums">
												{row.label}
											</span>
											<span className="text-base leading-relaxed font-bold">
												{row.text}
											</span>
										</p>
										<ol className="border-border mb-2 ml-3 border-l pl-3">
											{row.children.map((child) => (
												<li key={`${child.text}-${child.index}`}>
													{stepBox(child.text, child.index, child.label, true)}
												</li>
											))}
										</ol>
									</li>
								) : (
									<li
										key={`${row.text}-${row.index}`}
										className="border-border border-b"
									>
										{stepBox(row.text, row.index, row.label)}
									</li>
								),
							)
						) : (
							<li className="border-foreground/40 border-dashed p-4 text-sm font-semibold">
								no steps yet
							</li>
						)}
					</ol>
				</section>
			</div>
			{recipe.sourceNotes ? (
				<section className="mt-10">
					<h2 className={sectionLabelClassName}>recipe notes</h2>
					<p className="mt-3 text-base leading-relaxed whitespace-pre-line">
						{recipe.sourceNotes}
					</p>
				</section>
			) : null}
			{recipe.notes ? (
				<section className="mt-10">
					<h2 className={sectionLabelClassName}>notes</h2>
					<p className="mt-2 p-4 text-sm font-semibold whitespace-pre-line">
						{recipe.notes}
					</p>
				</section>
			) : null}
		</>
	)
}

function RecipeMeta({ recipe }: { recipe: Recipe }) {
	const source = recipe.sourceUrl
		? importSiteForUrl(recipe.sourceUrl)
		: undefined

	const items = [
		recipe.forkedFromId ? <span key="copy">your copy</span> : null,
		recipe.servings ? (
			<span key="servings">serves {recipe.servings}</span>
		) : null,
		recipe.totalMinutes ? (
			<span key="minutes">{formatMinutes(recipe.totalMinutes)}</span>
		) : null,
		recipe.sourceUrl ? (
			<a
				key="source"
				href={recipe.sourceUrl}
				target="_blank"
				rel="noreferrer"
				className="hover:text-foreground focus-visible:outline-kitchen-eggplant inline-flex items-center gap-1.5 underline focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				{source ? (
					<img
						src={importSiteLogo(source.id)}
						alt=""
						className="size-4 shrink-0 no-underline"
					/>
				) : null}
				from {hostOf(recipe.sourceUrl)}
			</a>
		) : null,
	].filter((item) => item !== null)

	if (!items.length) return null

	return (
		<p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
			{items.map((item, index) => (
				<Fragment key={item.key}>
					{index > 0 ? <span aria-hidden>·</span> : null}
					{item}
				</Fragment>
			))}
		</p>
	)
}

// Makes a recipe wholly the cook's: no "your copy" label, no link to the site
// it came from. A shared recipe is copied for them first.
function ClaimButton({
	recipe,
	disabled,
}: {
	recipe: Recipe
	disabled: boolean
}) {
	const router = useRouter()
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const [pending, setPending] = useState(false)

	const claim = async () => {
		setPending(true)

		try {
			const claimed = await claimRecipe({ data: { id: recipe.id } })

			if (!claimed) throw new Error('recipe was not claimed')

			await Promise.all([
				router.invalidate(),
				queryClient.invalidateQueries({ queryKey: ['shelf'] }),
				queryClient.invalidateQueries({ queryKey: ['recipe'] }),
			])

			if (claimed.id !== recipe.id)
				await navigate({
					to: '/recipes/$recipeId',
					params: { recipeId: claimed.id },
					replace: true,
				})
			toast.success(`${recipe.title} is yours now`)
		} catch {
			toast.error("couldn't take that over — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<button
			type="button"
			disabled={disabled || pending}
			onClick={() => void claim()}
			className={buttonVariants({ variant: 'outline' })}
		>
			<UserCheckIcon size={14} weight="bold" aria-hidden />
			make it mine
		</button>
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
