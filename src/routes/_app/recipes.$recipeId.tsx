import {
	ArrowLeft,
	BookmarkSimpleIcon,
	CookingPotIcon,
	PencilSimple,
} from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { Fragment, useRef, useState } from 'react'
import { toast } from 'sonner'

import { IngredientText } from '@/components/ingredient-text'
import { RecipeEditor } from '@/components/recipe-editor'
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog'
import type { collections } from '@/db/schema'
import {
	getCooking,
	updateCooking,
	type listActiveCooking,
} from '@/lib/cooking/server'
import { importSiteForUrl, importSiteLogo } from '@/lib/import/sites'
import { categorySprites } from '@/lib/pantry/catalog'
import { ingredientViewRows } from '@/lib/recipes/ingredient-groups'
import { formatMinutes } from '@/lib/recipes/model'
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

const sectionLabelClassName =
	'inline-block border-b-3 pb-0.5 text-xs font-semibold'

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
				'bg-background text-foreground min-h-dvh p-6 md:p-10',
				!editing && 'pb-tabbar md:pb-10',
			)}
		>
			<div className="max-w-2xl">
				<Link
					to="/recipes"
					className="focus-visible:outline-kitchen-eggplant mb-4 inline-flex items-center gap-1.5 text-xs font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					<ArrowLeft size={14} weight="bold" aria-hidden />
					recipes
				</Link>
				{editing ? (
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
				) : (
					<RecipeView
						recipe={recipe}
						books={books}
						onEdit={() => {
							setEditing(true)
						}}
					/>
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
	const [grouped, setGrouped] = useState(true)
	const [startPrompt, setStartPrompt] = useState<string | null>(null)
	const versions = useRef(new Map<string, number>())
	const client = useQueryClient()
	const queryKey = ['cooking', recipe.id, recipe.ingredients, recipe.steps]

	const updateTrackerCheck = (item: string, done: boolean) => {
		client.setQueryData<Awaited<ReturnType<typeof listActiveCooking>>>(
			['active-cooking'],
			(sessions) =>
				sessions?.map((session) => {
					if (session.recipeId !== recipe.id) return session
					const checked = new Set(session.checked)

					if (done) checked.add(item)
					else checked.delete(item)

					return { ...session, checked: [...checked] }
				}),
		)
	}

	const progress = useQuery({
		queryKey,
		queryFn: () => getCooking({ data: { recipeId: recipe.id } }),
		retry: false,
		refetchOnWindowFocus: true,
	})

	const command = useMutation({
		mutationKey: ['cooking-command', recipe.id],
		scope: { id: `cooking-${recipe.id}` },
		mutationFn: (
			data: Omit<Parameters<typeof updateCooking>[0]['data'], 'recipeId'>,
		) => updateCooking({ data: { ...data, recipeId: recipe.id } }),

		onMutate: async (variables) => {
			await client.cancelQueries({ queryKey })

			if (variables.action === 'finish') {
				await client.cancelQueries({ queryKey: ['active-cooking'] })

				const previous =
					client.getQueryData<Awaited<ReturnType<typeof getCooking>>>(queryKey)

				const session = client
					.getQueryData<Awaited<ReturnType<typeof listActiveCooking>>>([
						'active-cooking',
					])
					?.find((entry) => entry.recipeId === recipe.id)

				client.setQueryData(queryKey, null)
				client.setQueryData<Awaited<ReturnType<typeof listActiveCooking>>>(
					['active-cooking'],
					(sessions) =>
						sessions?.filter((entry) => entry.recipeId !== recipe.id),
				)

				return { kind: 'finish' as const, previous, session }
			}

			if (variables.action !== 'check' || !variables.item) return null
			const item = variables.item
			const version = (versions.current.get(item) ?? 0) + 1
			versions.current.set(item, version)

			const previous =
				client.getQueryData<Awaited<ReturnType<typeof getCooking>>>(queryKey)

			client.setQueryData<Awaited<ReturnType<typeof getCooking>>>(
				queryKey,
				(current) => {
					if (!current) return current
					const checked = new Set(current.checked)

					if (variables.done) checked.add(item)
					else checked.delete(item)

					return { ...current, checked: [...checked] }
				},
			)

			updateTrackerCheck(item, variables.done === true)

			return {
				kind: 'check' as const,
				item,
				version,
				wasChecked: previous?.checked.includes(item) ?? false,
			}
		},
		onSuccess: (data, variables) => {
			if (variables.action !== 'check') {
				setStartPrompt(null)
				client.setQueryData(queryKey, data)
			}

			if (!data) void client.invalidateQueries({ queryKey: ['shelf'] })
		},
		onError: (error, _variables, context) => {
			if (context?.kind === 'finish') {
				if (context.previous !== undefined)
					client.setQueryData(queryKey, context.previous)

				if (context.session) {
					const session = context.session
					client.setQueryData<Awaited<ReturnType<typeof listActiveCooking>>>(
						['active-cooking'],
						(sessions) =>
							sessions?.some((entry) => entry.recipeId === recipe.id)
								? sessions
								: [...(sessions ?? []), session],
					)
				}
			}

			if (
				context?.kind === 'check' &&
				versions.current.get(context.item) === context.version
			) {
				updateTrackerCheck(context.item, context.wasChecked)
				client.setQueryData<Awaited<ReturnType<typeof getCooking>>>(
					queryKey,
					(current) => {
						if (!current) return current
						const checked = new Set(current.checked)

						if (context.wasChecked) checked.add(context.item)
						else checked.delete(context.item)

						return { ...current, checked: [...checked] }
					},
				)
			}

			toast.error(
				error.message || 'Could not save cooking progress. Please retry.',
			)
		},
		onSettled: () => {
			if (
				client.isMutating({ mutationKey: ['cooking-command', recipe.id] }) === 1
			) {
				void client.invalidateQueries({ queryKey })
				void client.invalidateQueries({ queryKey: ['active-cooking'] })
			}
		},
	})

	const cooking = progress.data?.active === true
	const checked = new Set(progress.data?.checked ?? [])
	const rows = ingredientViewRows(recipe.ingredients, !cooking && grouped)
	const RowBody = 'label'
	const busy = command.isPending

	const toggle = (item: string) =>
		cooking
			? command.mutate({ action: 'check', item, done: !checked.has(item) })
			: setStartPrompt(item)

	return (
		<>
			<Dialog
				open={startPrompt !== null}
				onOpenChange={(open) => {
					if (!open && !busy) setStartPrompt(null)
				}}
			>
				<DialogContent>
					<DialogTitle>Start cooking?</DialogTitle>
					<DialogDescription>
						Track ingredients and steps for {recipe.title}. Your progress is
						saved, so you can come back anytime.
					</DialogDescription>
					<div className="flex justify-end gap-3">
						<button
							type="button"
							onClick={() => setStartPrompt(null)}
							disabled={busy}
							className="rounded-md border px-3 py-2 text-sm"
						>
							cancel
						</button>
						<button
							type="button"
							disabled={busy}
							className="bg-kitchen-basil rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
							onClick={async () => {
								const item = startPrompt

								try {
									await command.mutateAsync({ action: 'start' })

									if (item)
										await command.mutateAsync({
											action: 'check',
											item,
											done: true,
										})
								} catch {
									/* The mutation reports the error and leaves the action available. */
								}
							}}
						>
							{busy ? 'starting…' : 'start cooking'}
						</button>
					</div>
				</DialogContent>
			</Dialog>
			<div className="flex items-start gap-4">
				{recipe.imageUrl ? (
					<img
						src={recipe.imageUrl}
						alt={recipe.title}
						className="border-border size-20 shrink-0 object-cover md:size-28"
					/>
				) : null}
				<div className="min-w-0">
					<h1 className="text-4xl font-bold tracking-tight md:text-5xl">
						{recipe.title}
					</h1>
					<RecipeMeta recipe={recipe} />
				</div>
			</div>
			<div
				className={cn(
					'mt-6 flex flex-wrap items-center gap-3',
					!cooking && !progress.isError && 'hidden',
				)}
			>
				{cooking ? (
					<div className="border-kitchen-basil/50 bg-kitchen-basil/10 flex w-full flex-wrap items-center gap-3 rounded-xl border p-4">
						<output
							aria-live="polite"
							className="mr-auto text-sm font-semibold"
						>
							{
								recipe.steps.filter((_, index) => checked.has(`s${index}`))
									.length
							}{' '}
							of {recipe.steps.length} steps ·{' '}
							{
								recipe.ingredients.filter((_, index) =>
									checked.has(`i${index}`),
								).length
							}{' '}
							ingredients ready
						</output>
						<button
							type="button"
							disabled={busy}
							onClick={() => command.mutate({ action: 'finish' })}
							className="bg-kitchen-basil focus-visible:outline-kitchen-eggplant rounded-lg px-4 py-2 text-sm font-bold focus-visible:outline-2 disabled:opacity-50"
						>
							end cooking
						</button>
					</div>
				) : null}
				{progress.isError ? (
					<p role="alert" className="text-sm">
						Could not load cooking progress.{' '}
						<button
							type="button"
							onClick={() => void progress.refetch()}
							className="font-semibold underline"
						>
							retry
						</button>
					</p>
				) : null}
			</div>
			<div className="mt-6 flex flex-wrap items-center gap-3">
				{recipe.owned ? null : <SaveButton recipe={recipe} />}
				{!cooking ? (
					<button
						type="button"
						disabled={
							busy ||
							progress.isPending ||
							progress.isError ||
							(!recipe.ingredients.length && !recipe.steps.length)
						}
						onClick={() => command.mutate({ action: 'start' })}
						className={cn(
							recipeActionClassName,
							'border-input w-auto border bg-kitchen-basil/15',
						)}
					>
						<CookingPotIcon
							size={14}
							weight="duotone"
							aria-hidden
							className="size-3.5"
						/>
						{busy
							? 'starting…'
							: progress.data
								? 'resume cooking'
								: 'start cooking'}
					</button>
				) : null}
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant inline-flex items-center gap-1 px-1 py-1 text-xs font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2"
					onClick={onEdit}
					disabled={cooking || busy}
				>
					<PencilSimple size={12} weight="bold" aria-hidden />
					edit
				</button>
				{recipe.saved && books.length ? (
					<BookPicker recipe={recipe} books={books} />
				) : null}
			</div>
			<section className="mt-10">
				<h2 className="text-xs font-semibold">
					<span className={cn(sectionLabelClassName, 'border-kitchen-tomato')}>
						ingredients
					</span>
				</h2>
				{!cooking ? (
					<fieldset
						aria-label="ingredient order"
						className="border-input mt-4 inline-flex gap-1 rounded-lg border p-1"
					>
						{[
							{ label: 'by category', value: true },
							{ label: 'recipe order', value: false },
						].map(({ label, value }) => (
							<button
								key={label}
								type="button"
								aria-pressed={grouped === value}
								onClick={() => setGrouped(value)}
								className={cn(
									'focus-visible:outline-kitchen-eggplant rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-2',
									grouped === value && 'bg-kitchen-yolk/40',
								)}
							>
								{label}
							</button>
						))}
					</fieldset>
				) : null}

				<ul
					aria-label="ingredients"
					className="border-border bg-card mt-5 overflow-hidden rounded-xl border"
				>
					{recipe.ingredients.length ? (
						rows.map((row) => {
							const ingredient = row.text
							const heading = row.kind === 'heading' ? row.text : undefined

							if (heading !== undefined)
								return (
									<li
										key={row.key}
										className="border-border bg-background border-b px-4 py-3 text-sm font-semibold"
									>
										<span className="flex items-center gap-2">
											{row.kind === 'heading' && row.category ? (
												<img
													src={`/sprites/pantry/${categorySprites[row.category]}.png`}
													alt=""
													className="size-6 shrink-0 object-contain [image-rendering:pixelated]"
												/>
											) : null}
											{heading}
										</span>
									</li>
								)

							if (row.kind !== 'ingredient') return null
							const item = `i${row.index}`
							const done = cooking && checked.has(item)

							return (
								<li
									key={row.key}
									className="border-foreground/15 border-b last:border-b-0"
								>
									<RowBody
										className={cn(
											'flex cursor-pointer items-start gap-3 px-4 py-3',
											cooking && 'cursor-pointer',
										)}
									>
										<input
											type="checkbox"
											aria-label={ingredient}
											checked={done}
											onChange={() => toggle(item)}
											disabled={
												progress.isPending ||
												progress.isError ||
												(busy && command.variables?.action === 'finish')
											}
											className="accent-kitchen-basil mt-1 size-5 shrink-0"
										/>
										<IngredientText text={ingredient} done={done} />
									</RowBody>
								</li>
							)
						})
					) : (
						<li className="border-foreground/40 border-dashed p-4 text-sm font-semibold">
							no ingredients yet
						</li>
					)}
				</ul>
			</section>
			<section className="mt-10">
				<h2 className="text-xs font-semibold">
					<span
						className={cn(sectionLabelClassName, 'border-kitchen-eggplant')}
					>
						steps
					</span>
				</h2>
				<ol className="border-border bg-card mt-4 overflow-hidden rounded-xl border">
					{recipe.steps.length ? (
						recipe.steps.map((step, index) => {
							const item = `s${index}`
							const done = cooking && checked.has(item)

							return (
								<li
									key={`${step}-${index}`}
									className="border-foreground/15 border-b last:border-b-0"
								>
									<RowBody
										className={cn(
											'flex cursor-pointer items-start gap-3 px-4 py-3',
											cooking && 'cursor-pointer',
										)}
									>
										<input
											type="checkbox"
											aria-label={`step ${index + 1}: ${step}`}
											checked={done}
											onChange={() => toggle(item)}
											disabled={
												progress.isPending ||
												progress.isError ||
												(busy && command.variables?.action === 'finish')
											}
											className="accent-kitchen-basil mt-0.5 size-5 shrink-0"
										/>
										<span className="text-muted-foreground mt-0.5 text-xs font-bold">
											{index + 1}
										</span>
										<span
											className={cn(
												'text-sm font-semibold',
												done && 'text-muted-foreground line-through',
											)}
										>
											{step}
										</span>
									</RowBody>
								</li>
							)
						})
					) : (
						<li className="border-foreground/40 border-dashed p-4 text-sm font-semibold">
							no steps yet
						</li>
					)}
				</ol>
			</section>
			{recipe.notes ? (
				<section className="mt-10">
					<h2 className="text-xs font-semibold">
						<span className={cn(sectionLabelClassName, 'border-kitchen-yolk')}>
							notes
						</span>
					</h2>
					<p className="border-border bg-card mt-4 overflow-hidden rounded-xl border p-4 text-sm font-semibold whitespace-pre-line">
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

// Shared dimensions keep the recipe's actions aligned in one compact row.
const recipeActionClassName =
	'focus-visible:outline-kitchen-eggplant inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'

// A shared recipe someone opened from a search or a link. Adding it puts it on
// the shelf as is; books come after. A secondary button, not a solid one: the
// recipe itself is what the page is for.
function SaveButton({ recipe }: { recipe: Recipe }) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [pending, setPending] = useState(false)

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
				onClick={() => void save()}
				className={cn(
					recipeActionClassName,
					'border-input bg-background hover:bg-card border md:bg-transparent',
				)}
			>
				<BookmarkSimpleIcon
					size={14}
					weight={recipe.saved ? 'fill' : 'bold'}
					aria-hidden
					className="size-3.5"
				/>
				{recipe.saved ? 'remove from shelf' : 'save to shelf'}
			</button>
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
