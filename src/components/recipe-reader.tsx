import { Dialog } from '@base-ui/react/dialog'
import {
	ArrowsOutSimpleIcon,
	BookmarkSimpleIcon,
	ChatCircleIcon,
	GlobeHemisphereWestIcon,
	LinkSimpleIcon,
	LockSimpleIcon,
	XIcon,
	YoutubeLogoIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'

import { EffortCard, effortShown } from '@/components/effort-card'
import { AddToGroceries } from '@/components/grocery-send'
import { IngredientText } from '@/components/ingredient-text'
import { KitchenTag } from '@/components/kitchen-tag'
import { PageTitle } from '@/components/page'
import { PantrySprite } from '@/components/pantry-sprite'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { compactCount, RecipeRating } from '@/components/recipe-rating'
import { RecipeTags } from '@/components/recipe-tags'
import {
	useMarkHave,
	usePantry,
	useWaitingGroceries,
} from '@/components/use-pantry'
import { mealTags } from '@/lib/assistant/meal-parts'
import { importSiteForUrl, importSiteLogo } from '@/lib/import/sites'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { lineStatus } from '@/lib/pantry/status'
import { recipeEffort } from '@/lib/recipes/effort'
import { ingredientViewRows } from '@/lib/recipes/ingredient-groups'
import { ingredientHeading } from '@/lib/recipes/ingredient-line'
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
	links?: string[] | undefined
	sourceNotes?: string | null | undefined
	notes?: string | null | undefined
	servings: number | null
	totalMinutes: number | null
	prepMinutes?: number | null | undefined
	// What the page it came from says its readers thought of it.
	ratingValue?: number | null | undefined
	ratingCount?: number | null | undefined
	commentCount?: number | null | undefined
	ingredients: string[]
	ingredientCategories?: IngredientCategories | undefined
	steps: string[]
}

const sectionLabelClassName = 'text-lg font-semibold'

export function RecipeReader({
	recipe,
	actions,
	authorship,
	status,
	heading = 'h1',
	shop = false,
	ingredientsView,
	ingredientsAction,
}: {
	recipe: ReadableRecipe
	// What the reader can do with it, under the title: save, edit, share.
	actions?: React.ReactNode
	authorship?: string | undefined
	status?:
		| { saved: boolean; visibility?: 'public' | 'private' | undefined }
		| undefined
	heading?: 'h1' | 'h2'
	// Whether the ingredients can go on the groceries list.
	shop?: boolean
	// Another way to show the ingredients, in place of the list as written,
	// and a control beside their heading.
	ingredientsView?: React.ReactNode
	ingredientsAction?: React.ReactNode
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

	// What the kitchen has of each line, for a reader who keeps a pantry or a
	// list. A reader with neither sees no marks: "need" on every line would
	// say nothing.
	const pantry = usePantry(shop).data ?? []
	const waiting = useWaitingGroceries(shop).data ?? []
	const knows = pantry.length > 0 || waiting.length > 0
	const markHave = useMarkHave()

	const statusOf = (line: string) =>
		knows ? lineStatus(line, pantry, waiting) : undefined

	// The foods it takes, without its section names.
	const foods = recipe.ingredients.filter(
		(line) => line.trim() && ingredientHeading(line) === undefined,
	)

	// What it asks of the cook: its time, the meals it makes, how they keep.
	const effort = recipeEffort({ ...recipe, foods })

	const carded = effortShown(effort)

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
		<div className="@container">
			<div
				className={cn(
					'flex gap-4',
					recipe.imageUrl
						? 'flex-col @xl:flex-row @xl:items-start @xl:gap-6'
						: 'items-start',
				)}
			>
				<div className={cn('relative shrink-0', recipe.imageUrl && '@xl:w-72')}>
					{recipe.imageUrl ? (
						<PhotoFullScreen src={recipe.imageUrl} title={recipe.title} />
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
					{status?.saved || status?.visibility ? (
						<span className="absolute -top-1 -right-1 flex gap-1">
							{status.saved && !status.visibility ? (
								<span
									className="bg-card border-border grid size-6 place-items-center rounded-md border"
									title="saved recipe"
								>
									<span className="sr-only">saved recipe</span>
									<BookmarkSimpleIcon
										size={14}
										weight="fill"
										aria-hidden
										className="text-kitchen-eggplant"
									/>
								</span>
							) : null}
							{status.visibility ? (
								<span
									className="bg-card border-border grid size-6 place-items-center rounded-md border"
									title={
										status.visibility === 'public'
											? 'public recipe'
											: 'private recipe'
									}
								>
									<span className="sr-only">
										{status.visibility === 'public'
											? 'public recipe'
											: 'private recipe'}
									</span>
									{status.visibility === 'public' ? (
										<GlobeHemisphereWestIcon size={14} aria-hidden />
									) : (
										<LockSimpleIcon size={14} aria-hidden />
									)}
								</span>
							) : null}
						</span>
					) : null}
				</div>
				<div className="min-w-0">
					<PageTitle as={heading} className="text-2xl md:text-4xl">
						{recipe.title}
					</PageTitle>
					{authorship ? (
						<p className="text-muted-foreground mt-2 text-sm">{authorship}</p>
					) : null}
					{/* With the card to say them, its time and servings aren't said
					    twice. */}
					<RecipeMeta recipe={recipe} brief={carded} />
					<EffortCard
						effort={effort}
						tags={
							<RecipeTags
								title={recipe.title}
								// Read from its name, as a list does before it is tagged.
								tags={mealTags(recipe.title)}
								vegetarian={effort.vegetarian}
								vegan={effort.vegan}
								withTemperature
							/>
						}
					/>
				</div>
			</div>
			{actions}
			<div className="mt-8 grid gap-10 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @2xl:items-start @2xl:gap-12">
				<section>
					<div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
						<h2 className={sectionLabelClassName}>ingredients</h2>
						{shop ? (
							<AddToGroceries
								recipeId={recipe.id}
								title={recipe.title}
								lines={recipe.ingredients}
							/>
						) : null}
						{ingredientsAction}
					</div>

					{ingredientsView ? (
						<div className="mt-2">{ingredientsView}</div>
					) : (
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
											const look = ingredientItemLook(row.text)

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
																{look ? (
																	<PantrySprite
																		look={look}
																		className="size-6"
																	/>
																) : null}
															</span>
															<IngredientText text={row.text} done={done} />
															<KitchenTag
																status={statusOf(row.text)}
																onHave={() => void markHave(row.text)}
																className="mt-1.5"
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
					)}
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
		</div>
	)
}

// Servings, time, and the page or video the recipe came from, if it has one.
function RecipeMeta({
	recipe,
	brief = false,
}: {
	recipe: ReadableRecipe
	// Without its time and servings, which a card beside it says.
	brief?: boolean
}) {
	const source = recipe.sourceUrl
		? importSiteForUrl(recipe.sourceUrl)
		: undefined

	const video = recipe.sourceUrl ? isYouTube(recipe.sourceUrl) : false

	const items = [
		recipe.ratingValue !== null &&
		recipe.ratingValue !== undefined &&
		recipe.ratingCount ? (
			<RecipeRating
				key="rating"
				rating={{ value: recipe.ratingValue, count: recipe.ratingCount }}
			/>
		) : null,
		recipe.commentCount && recipe.sourceUrl ? (
			<a
				key="comments"
				href={recipe.sourceUrl}
				target="_blank"
				rel="noreferrer"
				className="hover:text-foreground inline-flex items-center gap-1 underline"
			>
				<ChatCircleIcon size={14} aria-hidden />
				{compactCount(recipe.commentCount)}{' '}
				{recipe.commentCount === 1 ? 'comment' : 'comments'}
			</a>
		) : null,
		recipe.servings && !brief ? (
			<span key="servings">serves {recipe.servings}</span>
		) : null,
		recipe.totalMinutes && !brief ? (
			<span key="minutes">{formatMinutes(recipe.totalMinutes)}</span>
		) : null,
		recipe.sourceUrl ? (
			<a
				key="source"
				href={recipe.sourceUrl}
				target="_blank"
				rel="noreferrer"
				className="hover:text-foreground inline-flex items-center gap-1.5 underline"
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
		...(recipe.links ?? []).map((link, index) => (
			<a
				// The same page can be linked twice; its place tells them apart.
				// oxlint-disable-next-line react/no-array-index-key
				key={`link-${index}`}
				href={link}
				target="_blank"
				rel="noreferrer"
				className="hover:text-foreground inline-flex items-center gap-1.5 underline"
			>
				{isYouTube(link) ? (
					<YoutubeLogoIcon size={16} weight="fill" aria-hidden />
				) : (
					<LinkSimpleIcon size={16} aria-hidden />
				)}
				{isYouTube(link) ? 'youtube video' : hostOf(link)}
			</a>
		)),
	].filter((item) => item !== null)

	if (!items.length) return null

	return (
		// Every item leads with a dot; the one that starts a line hangs past the
		// left edge and is cut off, so no line starts or ends on a dot.
		<div className="text-muted-foreground mt-3 overflow-hidden text-sm font-semibold">
			<p className="-ml-6 flex flex-wrap items-center gap-y-1">
				{items.map((item) => (
					<span
						key={item.key}
						className="inline-flex items-center pl-2 before:mr-2 before:w-2 before:text-center before:content-['·']"
					>
						{item}
					</span>
				))}
			</p>
		</div>
	)
}

// The recipe's photo, which opens to the whole screen on a tap, uncropped,
// and closes on a tap, the cross, or escape.
function PhotoFullScreen({ src, title }: { src: string; title: string }) {
	return (
		<Dialog.Root>
			<Dialog.Trigger
				aria-label={`see the photo of ${title} full screen`}
				className="group relative block w-full cursor-zoom-in"
			>
				<img
					src={src}
					alt={title}
					className="border-border aspect-[4/3] w-full rounded-xl border object-cover"
				/>
				<span
					aria-hidden
					className="bg-card/90 border-border absolute right-2 bottom-2 grid size-8 place-items-center rounded-full border shadow-md transition-transform group-hover:scale-110"
				>
					<ArrowsOutSimpleIcon size={16} weight="bold" />
				</span>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="bg-foreground fixed inset-0 z-50" />
				<Dialog.Popup className="fixed inset-0 z-50 grid place-items-center p-4 outline-none md:p-10">
					<Dialog.Title className="sr-only">{title}</Dialog.Title>
					<Dialog.Close
						aria-label="close the photo"
						className="grid size-full cursor-zoom-out place-items-center"
					>
						<img
							src={src}
							alt={title}
							className="max-h-full max-w-full rounded-xl object-contain"
						/>
					</Dialog.Close>
					<Dialog.Close
						aria-label="close"
						className="bg-card text-foreground absolute top-4 right-4 grid size-11 place-items-center rounded-full shadow-md"
					>
						<XIcon size={20} weight="bold" aria-hidden />
					</Dialog.Close>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
