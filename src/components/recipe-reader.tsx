import { YoutubeLogoIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Fragment, useState } from 'react'

import { IngredientText } from '@/components/ingredient-text'
import { Marked } from '@/components/marked'
import { PageTitle } from '@/components/page'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { importSiteForUrl, importSiteLogo } from '@/lib/import/sites'
import { ingredientItemSprite } from '@/lib/pantry/sprites'
import { ingredientViewRows } from '@/lib/recipes/ingredient-groups'
import type { IngredientCategories } from '@/lib/recipes/model'
import { formatMinutes } from '@/lib/recipes/model'
import { hostOf, isYouTube } from '@/lib/recipes/source'
import { stepRows } from '@/lib/recipes/step-groups'
import { tileColorFor, tileColors } from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'

// What a recipe needs to be read: every page that shows one, in the shelf, in
// the finder's preview and on a shared link, draws it with this.
export type ReadableRecipe = {
	id: string
	title: string
	imageUrl: string | null
	sourceUrl: string | null
	sourceNotes?: string | null | undefined
	notes?: string | null | undefined
	servings: number | null
	totalMinutes: number | null
	ingredients: string[]
	ingredientCategories?: IngredientCategories | undefined
	steps: string[]
	// The cook's copy points back to the version it was made from.
	forkedFromId?: string | null | undefined
	original?: { id: string; title: string } | null | undefined
}

const sectionLabelClassName = 'text-lg font-semibold'

export function RecipeReader({
	recipe,
	actions,
	terms = [],
	heading = 'h1',
}: {
	recipe: ReadableRecipe
	// What the reader can do with it, under the title: save, edit, share.
	actions?: React.ReactNode
	// Search words to mark wherever they appear.
	terms?: string[]
	heading?: 'h1' | 'h2'
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
					<Marked text={text} terms={terms} />
				</span>
			</RowBody>
		)
	}

	return (
		<div className="@container">
			<div className="flex items-start gap-4">
				{recipe.imageUrl ? (
					<img
						src={recipe.imageUrl}
						alt={recipe.title}
						className="border-border size-16 shrink-0 rounded-xl border object-cover md:size-24"
					/>
				) : (
					<span
						aria-hidden
						className={cn(
							'border-border grid size-16 shrink-0 place-items-center rounded-xl border md:size-24',
							tileColors[tileColorFor(recipe.id)],
						)}
					>
						<RecipeGlyph title={recipe.title} className="size-9 md:size-14" />
					</span>
				)}
				<div className="min-w-0">
					<PageTitle as={heading} className="text-2xl md:text-4xl">
						<Marked text={recipe.title} terms={terms} />
					</PageTitle>
					<RecipeMeta recipe={recipe} />
				</div>
			</div>
			{actions}
			<div className="mt-8 grid gap-10 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @2xl:items-start @2xl:gap-12">
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
														<Marked text={row.text} terms={terms} />
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
														<IngredientText
															text={row.text}
															done={done}
															terms={terms}
														/>
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
												<Marked text={row.text} terms={terms} />
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
		</div>
	)
}

// Where a recipe came from: the Dutch Oven recipe it was copied from and the
// page or video it started as. A recipe with neither is the cook's own.
function RecipeMeta({ recipe }: { recipe: ReadableRecipe }) {
	const source = recipe.sourceUrl
		? importSiteForUrl(recipe.sourceUrl)
		: undefined

	const video = recipe.sourceUrl ? isYouTube(recipe.sourceUrl) : false

	const items = [
		recipe.forkedFromId ? <span key="copy">your copy</span> : null,
		recipe.original ? (
			<Link
				key="original"
				to="/recipes/$recipeId"
				params={{ recipeId: recipe.original.id }}
				className="hover:text-foreground focus-visible:outline-kitchen-eggplant underline focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				see the original version
			</Link>
		) : null,
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
				{video ? (
					<YoutubeLogoIcon size={16} weight="fill" aria-hidden />
				) : source ? (
					<img
						src={importSiteLogo(source.id)}
						alt=""
						className="size-4 shrink-0 no-underline"
					/>
				) : null}
				{video ? 'watch on youtube' : `from ${hostOf(recipe.sourceUrl)}`}
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
