import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

import { EditSharedButton } from '@/components/edit-shared-button'
import { BackBar, BackLink, BackToSearch, PageTitle } from '@/components/page'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { RecipeReader } from '@/components/recipe-reader'
import { SaveRecipeButton } from '@/components/save-recipe-button'
import { buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { getRecipe } from '@/lib/recipes/server'
import type {
	readPublicProfile,
	readRecipeAt,
	readWebRecipe,
} from '@/lib/sharing/server'

export function PublicHeader() {
	return (
		<header className="border-border border-b px-6 py-5 md:px-10">
			<Link to="/" className="text-lg font-bold tracking-tight">
				cocochef
			</Link>
		</header>
	)
}

export function PublicProfile({
	profile,
}: {
	profile: NonNullable<Awaited<ReturnType<typeof readPublicProfile>>>
}) {
	return (
		<>
			<PublicHeader />
			<main className="mx-auto max-w-5xl p-6 md:p-10">
				<PageTitle>{profile.displayName}</PageTitle>
				<p className="text-muted-foreground mt-3">
					recipes to pass around the table.
				</p>
				<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{profile.recipes.map((recipe) => (
						<Link
							key={recipe.slug}
							to="/$handle/$slug"
							params={{ handle: profile.handle, slug: recipe.slug }}
							className="border-border bg-kitchen-tomato/15 overflow-hidden rounded-xl border"
						>
							<div className="bg-kitchen-yolk/15 aspect-[4/3]">
								{recipe.imageUrl ? (
									<img
										src={recipe.imageUrl}
										alt=""
										loading="lazy"
										className="h-full w-full object-cover"
									/>
								) : (
									<span className="text-foreground/60 grid h-full place-items-center">
										<RecipeGlyph title={recipe.title} size={48} />
									</span>
								)}
							</div>
							<h2 className="p-4 text-lg leading-snug font-bold break-words">
								{recipe.title}
							</h2>
						</Link>
					))}
				</div>
			</main>
		</>
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
				<BackBar>
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
						!unlisted ? (
							<div className="mt-6 flex flex-wrap gap-2">
								{saved.data?.owned ? (
									<Link
										to="/recipes/$recipeId"
										params={{ recipeId: recipe.id }}
										className={buttonVariants({ variant: 'outline' })}
									>
										open your recipe
									</Link>
								) : (
									<>
										<SaveRecipeButton
											recipe={recipe}
											onAuthenticated={() =>
												refreshSession((value) => value + 1)
											}
										/>
										<EditSharedButton recipeId={recipe.id} />
									</>
								)}
							</div>
						) : (
							<p className="text-muted-foreground border-border mt-6 border-t pt-5 text-sm">
								shared by link. anyone with this address can read this recipe.
							</p>
						)
					}
				/>
			</div>
		</main>
	)
}
