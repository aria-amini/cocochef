import {
	ArrowSquareOutIcon,
	BookOpenTextIcon,
	PencilSimpleIcon,
	ShareNetworkIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/avatar'
import { useEditShared } from '@/components/edit-shared-button'
import { BackBar, BackLink, BackToSearch, PageTitle } from '@/components/page'
import { RecipeMenu } from '@/components/recipe-menu'
import { RecipeReader } from '@/components/recipe-reader'
import { RecipeTileFace, recipeTileClassName } from '@/components/recipe-tile'
import { SaveRecipeButton } from '@/components/save-recipe-button'
import { Button, buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { formatMinutes } from '@/lib/recipes/model'
import { getRecipe } from '@/lib/recipes/server'
import { tileColorFor } from '@/lib/recipes/tile-color'
import type {
	readPublicProfile,
	readRecipeAt,
	readWebRecipe,
} from '@/lib/sharing/server'
import { count } from '@/lib/utils/count'

type Profile = NonNullable<Awaited<ReturnType<typeof readPublicProfile>>>

// How long it takes and how many it feeds, as far as the recipe says.
function detailOf(recipe: Profile['recipes'][number]) {
	return (
		[
			recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : undefined,
			recipe.servings ? `serves ${recipe.servings}` : undefined,
		]
			.filter(Boolean)
			.join(' · ') || undefined
	)
}

// Someone's published recipes, in the same app as your own shelf: who they
// are, a way to pass the page on, and their recipes as the shelf's tiles.
export function PublicProfile({ profile }: { profile: Profile }) {
	return (
		<main className="min-w-0 flex-1">
			<div className="flex w-full max-w-5xl min-w-0 flex-col gap-8 p-6 md:p-10">
				<header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex min-w-0 items-center gap-4">
						<Avatar name={profile.displayName} size="xl" />
						<div className="flex min-w-0 flex-col gap-1">
							<PageTitle>{profile.displayName}</PageTitle>
							<p className="text-muted-foreground text-sm font-semibold">
								@{profile.handle} ·{' '}
								{count(profile.recipes.length, 'recipe', 'recipes')}
							</p>
						</div>
					</div>
					<div className="flex shrink-0 flex-wrap gap-2">
						{profile.yours ? (
							<Link
								to="/settings"
								hash="public-profile"
								className={buttonVariants({ variant: 'outline' })}
							>
								<PencilSimpleIcon aria-hidden />
								edit profile
							</Link>
						) : null}
						<ShareProfileButton name={profile.displayName} />
					</div>
				</header>
				<section aria-labelledby="published" className="flex flex-col gap-3">
					<h2
						id="published"
						className="flex items-center gap-2 text-xl font-bold"
					>
						<BookOpenTextIcon size={20} weight="bold" aria-hidden />
						recipes
					</h2>
					<div className="grid grid-cols-2 gap-4 md:auto-rows-[var(--spacing-tile)] md:grid-cols-4">
						{profile.recipes.map((recipe) => (
							<ProfileTile
								key={recipe.slug}
								handle={profile.handle}
								recipe={recipe}
							/>
						))}
					</div>
				</section>
			</div>
		</main>
	)
}

function ProfileTile({
	handle,
	recipe,
}: {
	handle: string
	recipe: Profile['recipes'][number]
}) {
	return (
		<Link
			to="/$handle/$slug"
			params={{ handle, slug: recipe.slug }}
			className={recipeTileClassName({
				color: tileColorFor(recipe.id),
				photo: !!recipe.imageUrl,
			})}
		>
			<RecipeTileFace
				title={recipe.title}
				imageUrl={recipe.imageUrl}
				detail={detailOf(recipe)}
			/>
		</Link>
	)
}

// Passes the page on: the phone's share sheet where there is one, otherwise
// the address copied.
function ShareProfileButton({ name }: { name: string }) {
	async function share() {
		const url = window.location.href

		if (navigator.share) {
			try {
				await navigator.share({ title: `${name}’s recipes`, url })
			} catch {
				// Closing the share sheet is not a failure.
			}

			return
		}

		try {
			await navigator.clipboard.writeText(url)
			toast.success('link copied')
		} catch {
			toast.error("couldn't copy the link — try again")
		}
	}

	return (
		<Button variant="outline" onClick={() => void share()}>
			<ShareNetworkIcon aria-hidden />
			share
		</Button>
	)
}

type PublicRecipe =
	| Extract<
			Awaited<ReturnType<typeof readRecipeAt>>,
			{ kind: 'public' }
	  >['recipe']
	| NonNullable<Awaited<ReturnType<typeof readWebRecipe>>>

export function PublicRecipePage({
	recipe,
	unlisted = false,
}: {
	recipe: PublicRecipe
	unlisted?: boolean
}) {
	const [, refreshSession] = useState(0)
	const account = authClient.useSession().data?.user

	// Opened from home's search, the way back is to it.
	const foundBy = useRouterState({
		select: (state) => state.location.state.foundBy,
	})

	const saved = useQuery({
		queryKey: ['recipe', recipe.id, account?.id],
		queryFn: () => getRecipe({ data: { id: recipe.id } }),
		enabled: !!account,
	})

	return (
		<main className="bg-background text-foreground min-h-dvh min-w-0 flex-1 p-6 md:p-10">
			<div className="max-w-5xl">
				<BackBar
					end={
						unlisted ? undefined : (
							<PublicRecipeTools
								recipeId={recipe.id}
								owned={!!saved.data?.owned}
							/>
						)
					}
				>
					{foundBy !== undefined ? (
						<BackToSearch query={foundBy} />
					) : 'publisher' in recipe ? (
						<BackLink
							to="/$handle"
							params={{ handle: recipe.publisher.handle }}
						>
							{recipe.publisher.displayName}&apos;s recipes
						</BackLink>
					) : (
						<BackLink to="/recipes">back to my recipes</BackLink>
					)}
				</BackBar>
				<RecipeReader
					recipe={recipe}
					shop
					corner={
						!unlisted && !saved.data?.owned ? (
							<SaveRecipeButton
								recipe={recipe}
								large={!!recipe.imageUrl}
								onAuthenticated={() => refreshSession((value) => value + 1)}
							/>
						) : undefined
					}
					status={{
						saved: !!saved.data?.saved && !saved.data?.owned,
						visibility: saved.data?.owned
							? saved.data.visibility === 'public'
								? 'public'
								: 'private'
							: undefined,
					}}
					authorship={
						'publisher' in recipe
							? recipe.originalAuthorName
								? `copied from ${recipe.originalAuthorName}`
								: `created by ${recipe.publisher.displayName}`
							: undefined
					}
					actions={
						unlisted ? (
							<p className="text-muted-foreground border-border mt-6 border-t pt-5 text-sm">
								shared by link. anyone with this address can read this recipe.
							</p>
						) : undefined
					}
				/>
			</div>
		</main>
	)
}

// Someone else's recipe, behind "⋯": edit a copy of it, or, once it's the
// cook's own, go to theirs.
function PublicRecipeTools({
	recipeId,
	owned,
}: {
	recipeId: string
	owned: boolean
}) {
	const navigate = useNavigate()
	const shared = useEditShared({ recipeId })

	return (
		<>
			<RecipeMenu
				items={[
					owned
						? {
								key: 'open',
								label: 'open your recipe',
								icon: ArrowSquareOutIcon,
								onSelect: () =>
									void navigate({
										to: '/recipes/$recipeId',
										params: { recipeId },
									}),
							}
						: {
								key: 'edit',
								label: 'edit a copy',
								icon: PencilSimpleIcon,
								onSelect: shared.edit,
								disabled: shared.pending,
							},
				]}
			/>
			{shared.dialog}
		</>
	)
}
