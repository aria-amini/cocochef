import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'

import { IngredientText } from '@/components/ingredient-text'
import { BackLink, PageTitle } from '@/components/page'
import { ingredientHeading } from '@/lib/recipes/ingredient-line'
import { formatMinutes } from '@/lib/recipes/model'
import { stepRows } from '@/lib/recipes/step-groups'
import type {
	readPublicProfile,
	readPublicRecipe,
	readWebRecipe,
} from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

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
									) : null}
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
		<>
			<PublicHeader />
			<main className="mx-auto max-w-3xl space-y-8 p-6 pb-12 md:p-10">
				{'publisher' in recipe ? (
					<BackLink to="/$handle" params={{ handle: recipe.publisher.handle }}>
						{recipe.publisher.displayName}&apos;s recipes
					</BackLink>
				) : null}
				<div>
					<PageTitle>{recipe.title}</PageTitle>
					{recipe.sourceUrl ? (
						<p className="text-muted-foreground mt-3 text-sm">
							from{' '}
							<a
								href={recipe.sourceUrl}
								rel="noreferrer"
								className="font-semibold underline"
							>
								{new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')}
							</a>
						</p>
					) : null}
					{recipe.servings || recipe.totalMinutes ? (
						<p className="text-muted-foreground mt-3 text-sm">
							{[
								recipe.servings ? `${recipe.servings} servings` : null,
								recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : null,
							]
								.filter(Boolean)
								.join(' · ')}
						</p>
					) : null}
				</div>
				{recipe.imageUrl ? (
					<img
						src={recipe.imageUrl}
						alt={recipe.title}
						className="max-h-96 w-full rounded-xl object-cover"
					/>
				) : null}
				<section aria-labelledby="public-ingredients">
					<h2 id="public-ingredients" className="mb-4 text-xl font-bold">
						ingredients
					</h2>
					{recipe.ingredients.length ? (
						<ul className="border-border divide-border divide-y rounded-xl border">
							{recipe.ingredients.map((line, index) => (
								<li key={index} className="px-4 py-3">
									{ingredientHeading(line) !== undefined ? (
										<h3 className="font-semibold">{ingredientHeading(line)}</h3>
									) : (
										<IngredientText text={line} />
									)}
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground">no ingredients listed.</p>
					)}
				</section>
				<section aria-labelledby="public-steps">
					<h2 id="public-steps" className="mb-4 text-xl font-bold">
						steps
					</h2>
					{recipe.steps.length ? (
						<ol className="border-border divide-border divide-y rounded-xl border">
							{stepRows(recipe.steps).map((row) => (
								<li key={row.index} className="px-4 py-4">
									<div className="flex gap-4">
										<span className="text-muted-foreground font-semibold tabular-nums">
											{row.label}.
										</span>
										<p
											className={cn(
												'min-w-0 whitespace-pre-wrap',
												row.kind === 'group' && 'font-semibold',
											)}
										>
											{row.text.split('\n').map((line, i) => (
												<Fragment key={i}>
													{i ? <br /> : null}
													{line}
												</Fragment>
											))}
										</p>
									</div>
									{row.kind === 'group' ? (
										<ol className="border-border mt-2 ml-8 border-l">
											{row.children.map((child) => (
												<li
													key={child.index}
													className="flex gap-4 py-1.5 pl-4"
												>
													<span className="text-muted-foreground text-sm font-semibold tabular-nums">
														{child.label}
													</span>
													<p className="min-w-0 whitespace-pre-wrap">
														{child.text}
													</p>
												</li>
											))}
										</ol>
									) : null}
								</li>
							))}
						</ol>
					) : (
						<p className="text-muted-foreground">no steps listed.</p>
					)}
				</section>
				{recipe.sourceNotes ? (
					<section aria-labelledby="public-notes">
						<h2 id="public-notes" className="mb-4 text-xl font-bold">
							recipe notes
						</h2>
						<p className="whitespace-pre-line">{recipe.sourceNotes}</p>
					</section>
				) : null}
				{!unlisted ? (
					<Link
						to="/recipes/$recipeId"
						params={{ recipeId: recipe.id }}
						className="focus-visible:outline-kitchen-eggplant bg-kitchen-basil inline-flex min-h-11 items-center rounded-md px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
					>
						open in my kitchen
					</Link>
				) : (
					<p className="text-muted-foreground border-border border-t pt-5 text-sm">
						shared by link. anyone with this address can read this recipe.
					</p>
				)}
			</main>
		</>
	)
}
