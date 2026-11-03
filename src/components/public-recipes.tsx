import { Link } from '@tanstack/react-router'

import { AppChrome } from '@/components/app-chrome'
import { BackLink, PageTitle } from '@/components/page'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { RecipeReader } from '@/components/recipe-reader'
import { buttonVariants } from '@/components/ui/button'
import type {
	readPublicProfile,
	readPublicRecipe,
	readWebRecipe,
} from '@/lib/sharing/server'

export function PublicHeader() {
	return (
		<header className="border-border border-b px-6 py-5 md:px-10">
			<Link
				to="/"
				className="focus-visible:outline-kitchen-eggplant text-lg font-bold tracking-tight focus-visible:outline-2"
			>
				dutch-oven
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
				{profile.recipes.length ? (
					<div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
						{profile.recipes.map((recipe) => (
							<Link
								key={recipe.slug}
								to="/$handle/$slug"
								params={{ handle: profile.handle, slug: recipe.slug }}
								className="border-border bg-kitchen-tomato/15 focus-visible:outline-kitchen-eggplant overflow-hidden rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2"
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
				) : (
					<p className="border-border mt-8 rounded-xl border border-dashed p-6 text-sm">
						no public recipes yet. check back when something&apos;s cooking.
					</p>
				)}
			</main>
		</>
	)
}

type PublicRecipe =
	| NonNullable<Awaited<ReturnType<typeof readPublicRecipe>>>
	| NonNullable<Awaited<ReturnType<typeof readWebRecipe>>>

export function PublicRecipePage({
	recipe,
	unlisted = false,
}: {
	recipe: PublicRecipe
	unlisted?: boolean
}) {
	return (
		<AppChrome>
			<main className="bg-background text-foreground min-h-dvh min-w-0 flex-1 p-6 md:p-10">
				<div className="max-w-5xl">
					{'publisher' in recipe ? (
						<BackLink
							to="/$handle"
							params={{ handle: recipe.publisher.handle }}
							className="mb-2"
						>
							{recipe.publisher.displayName}&apos;s recipes
						</BackLink>
					) : null}
					<RecipeReader
						recipe={recipe}
						actions={
							!unlisted ? (
								<div className="mt-6">
									<Link
										to="/recipes/$recipeId"
										params={{ recipeId: recipe.id }}
										className={buttonVariants()}
									>
										open in my kitchen
									</Link>
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
		</AppChrome>
	)
}
