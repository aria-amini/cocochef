import { PencilSimple, SparkleIcon } from '@phosphor-icons/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { CopyRecipeButton } from '@/components/copy-recipe-button'
import { BackLink } from '@/components/page'
import { RecipeEditor } from '@/components/recipe-editor'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeSharing } from '@/components/recipe-sharing'
import { SaveRecipeButton } from '@/components/save-recipe-button'
import { buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { createAiVersion, getAiVersion, getRecipe } from '@/lib/recipes/server'
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
						<EditTools recipe={recipe} onLeave={() => setEditing(false)} />
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

// Rewrites and ownership belong to editing, so the read view stays quiet.
function EditTools({
	recipe,
	onLeave,
}: {
	recipe: Recipe
	onLeave: () => void
}) {
	return (
		<div className="mb-4 flex flex-wrap items-center gap-2 empty:hidden">
			<AiVersionControls recipeId={recipe.id} editing onCreated={onLeave} />
		</div>
	)
}

function AiVersionControls({
	recipeId,
	editing = false,
	onCreated,
}: {
	recipeId: string
	editing?: boolean
	onCreated?: () => void
}) {
	const session = authClient.useSession()
	const account = session.data?.user
	const navigate = useNavigate()
	const [authOpen, setAuthOpen] = useState(false)

	const versions = useQuery({
		queryKey: ['recipe-ai-version', recipeId],
		queryFn: () => getAiVersion({ data: { id: recipeId } }),
		enabled: Boolean(account && !account.isAnonymous),
	})

	const generate = useMutation({
		mutationFn: () => createAiVersion({ data: { id: recipeId } }),
		onSuccess: (version) => {
			if (version) onCreated?.()

			if (version)
				void navigate({
					to: '/recipes/$recipeId',
					params: { recipeId: version.cleanedId },
				})
		},
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "couldn't clean up this recipe",
			),
	})

	if (session.isPending) return null

	// The cleanup itself is an edit; the original/cleaned switch is for reading.
	if (!account || account.isAnonymous)
		return editing ? (
			<>
				<button
					type="button"
					className={buttonVariants({ variant: 'outline' })}
					onClick={() => setAuthOpen(true)}
				>
					<SparkleIcon size={14} weight="bold" aria-hidden />
					clean up with ai · beta
				</button>
				<AuthDialog
					open={authOpen}
					onOpenChange={setAuthOpen}
					redirect={`/recipes/${recipeId}`}
				/>
			</>
		) : null

	if (versions.isPending) return null

	if (versions.isError)
		return (
			<p role="alert" className="text-sm">
				couldn't load AI versions —{' '}
				<button
					type="button"
					className="underline"
					onClick={() => void versions.refetch()}
				>
					try again
				</button>
			</p>
		)
	const version = versions.data

	if (!version)
		return editing ? (
			<button
				type="button"
				disabled={generate.isPending}
				className={buttonVariants({ variant: 'outline' })}
				onClick={() => generate.mutate()}
				title="saves this recipe to your shelf and keeps the original intact"
			>
				<SparkleIcon size={14} weight="bold" aria-hidden />
				{generate.isPending ? 'cleaning up…' : 'clean up with ai · beta'}
			</button>
		) : null

	if (editing) return null

	const cleaned = version.cleanedId === recipeId

	return (
		<div className="mt-3 flex flex-wrap items-center gap-2">
			<span className="text-muted-foreground text-xs font-semibold">
				ai cleanup · beta
			</span>
			{[
				{ id: version.originalId, label: 'original' },
				{ id: version.cleanedId, label: 'cleaned' },
			].map(({ id, label }) => (
				<button
					key={id}
					type="button"
					aria-pressed={recipeId === id}
					className={cn(
						'rounded-md px-3 py-2 text-sm font-semibold ',
						recipeId === id && 'bg-kitchen-yolk/40',
					)}
					onClick={() =>
						void navigate({
							to: '/recipes/$recipeId',
							params: { recipeId: id },
						})
					}
				>
					{label}
				</button>
			))}
			{cleaned ? (
				<p className="text-muted-foreground w-full text-xs">
					AI can make mistakes — check the cleaned recipe before cooking.
				</p>
			) : null}
			{version.stale ? (
				<p className="text-muted-foreground w-full text-xs">
					the original has changed since this version was created
				</p>
			) : null}
		</div>
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
					<AiVersionControls recipeId={recipe.id} />
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
