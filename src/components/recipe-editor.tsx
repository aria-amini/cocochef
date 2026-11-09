import {
	ClipboardTextIcon,
	LinkSimpleIcon,
	TrashIcon,
} from '@phosphor-icons/react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react'
import { toast } from 'sonner'

import { DeleteRecipeDialog } from '@/components/delete-recipe-dialog'
import { IngredientListField } from '@/components/ingredient-list-field'
import { PasteRecipeDialog } from '@/components/paste-recipe-dialog'
import {
	FieldError,
	fieldLabelClassName,
	FormActions,
	primaryActionClassName,
	quietActionClassName,
	RecipeIntro,
	RecipeNameField,
} from '@/components/recipe-form'
import {
	GuestPhotoSlot,
	RecipePhotoField,
} from '@/components/recipe-photo-field'
import { StepsField, stepsFrom } from '@/components/steps-field'
import { buttonVariants } from '@/components/ui/button'
import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'
import { forgetRecipe } from '@/lib/recipes/last-opened'
import {
	recipeContentInput,
	recipeNotesMax,
	type IngredientCategories,
	recipeTitleMax,
} from '@/lib/recipes/model'
import { isPastedRecipe, parsePastedRecipe } from '@/lib/recipes/paste'
import { createRecipe, deleteRecipe, updateRecipe } from '@/lib/recipes/server'
import { isYouTube, parseSourceInput } from '@/lib/recipes/source'
import { formField } from '@/lib/utils/form'
import { cn } from '@/lib/utils/ui'

// What the editor needs from a saved recipe; a new recipe passes none.
export type EditableRecipe = {
	id: string
	title: string
	imageUrl: string | null
	// The page or video it came from, if any.
	sourceUrl: string | null
	notes: string | null
	ingredients: string[]
	ingredientCategories?: IngredientCategories | undefined
	steps: string[]
	finalizedAt: Date | null
	// Shared recipes are never changed: the first edit makes the user a copy.
	owned: boolean
	saved: boolean
}

// Each ingredient row submits its line and its picked category (empty when the
// category is left to the guess) side by side.
function categoriesFrom(data: FormData) {
	const picked = data.getAll('ingredient-category').map(String)

	return Object.fromEntries(
		data
			.getAll('ingredient')
			.map(String)
			.flatMap((line, index) => {
				const text = line.trim()

				return text && picked[index] ? [[text, picked[index]] as const] : []
			}),
	)
}

// What the form would save right now, or nothing while the name is empty.
function contentFrom(form: HTMLFormElement) {
	const data = new FormData(form)

	const parsed = recipeContentInput.safeParse({
		title: formField(data, 'title'),
		// Absent when the photo is untouched; empty when it was removed.
		imageUrl: data.has('imageUrl')
			? formField(data, 'imageUrl') || null
			: undefined,
		notes: formField(data, 'notes'),
		// Empty removes the link; text that is not an address yet leaves it alone.
		sourceUrl: parseSourceInput(formField(data, 'sourceUrl')),
		ingredients: data.getAll('ingredient').map(String),
		ingredientCategories: categoriesFrom(data),
		steps: stepsFrom(data),
	})

	return parsed.success ? parsed.data : undefined
}

// Compare the fields as they are written, even while a required value is invalid.
function changeSnapshot(form: HTMLFormElement, hadPhoto: boolean) {
	const data = new FormData(form)

	return {
		name: formField(data, 'title').trim(),
		link: formField(data, 'sourceUrl').trim(),
		photo: data.has('imageUrl')
			? formField(data, 'imageUrl') || (hadPhoto ? '' : undefined)
			: undefined,
		ingredients: JSON.stringify([
			data
				.getAll('ingredient')
				.map(String)
				.filter((value) => value.trim()),
			categoriesFrom(data),
		]),
		steps: JSON.stringify(stepsFrom(data)),
		notes: formField(data, 'notes').trim(),
	}
}

type ChangeSnapshot = ReturnType<typeof changeSnapshot>

function sortedLabel(ingredients: number, steps: number) {
	const count = (n: number, one: string, many: string) =>
		`${n} ${n === 1 ? one : many}`

	return `sorted into ${count(ingredients, 'ingredient', 'ingredients')} and ${count(steps, 'step', 'steps')}`
}

// The recipe written where it will be read: the name as its heading, then
// ingredients, steps and notes. It saves as you go; done finishes a draft.
// Pasting a whole recipe into an empty one sorts it into its parts; so does a
// recipe pasted into the one box, which arrives as `pasted`.
export function RecipeEditor({
	recipe,
	defaultTitle = '',
	pasted,
	onImportLink,
	onDone,
}: {
	recipe?: EditableRecipe | undefined
	// A new recipe's name, carried over from a search.
	defaultTitle?: string
	// A whole recipe pasted elsewhere, to sort into this new one.
	pasted?: string | undefined
	onImportLink?: (url?: string) => void
	onDone: (recipeId: string) => void
}) {
	const [pasteOpen, setPasteOpen] = useState(false)
	const router = useRouter()
	const navigate = useNavigate()
	const form = useRef<HTMLFormElement>(null)
	const recipeId = useRef(recipe?.id)
	const savedId = recipe?.id
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string>()
	const [unnamed, setUnnamed] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const [photoBusy, setPhotoBusy] = useState(false)
	const [changes, setChanges] = useState<string[]>([])
	const baseline = useRef<ChangeSnapshot | undefined>(undefined)

	const updateChanges = useCallback(() => {
		if (!form.current || !baseline.current) return
		const current = changeSnapshot(form.current, !!recipe?.imageUrl)
		const initial = baseline.current

		const keys: Array<keyof ChangeSnapshot> = [
			'name',
			'link',
			'photo',
			'ingredients',
			'steps',
			'notes',
		]

		const changed = keys.filter((key) => current[key] !== initial[key])
		setChanges((previous) =>
			previous.join('|') === changed.join('|') ? previous : changed,
		)
	}, [recipe?.imageUrl])

	const scheduleChanges = useCallback(() => {
		window.setTimeout(updateChanges, 0)
	}, [updateChanges])

	useLayoutEffect(() => {
		if (!form.current) return
		const initial = changeSnapshot(form.current, !!recipe?.imageUrl)
		baseline.current = recipe
			? initial
			: {
					name: '',
					link: '',
					photo: undefined,
					ingredients: JSON.stringify([[], {}]),
					steps: JSON.stringify([]),
					notes: '',
				}
		updateChanges()
		const observer = new MutationObserver(scheduleChanges)
		observer.observe(form.current, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['value'],
		})

		return () => observer.disconnect()
	}, [recipe, scheduleChanges, updateChanges])

	// Finishing keeps the draft, so a paste's undo toast must not take it back.
	const sortedToast = useRef<string | number>(undefined)
	const finishing = useRef(false)

	// A recipe pasted into the one box starts the page already sorted.
	const [arrived] = useState(() =>
		!recipe && pasted ? parsePastedRecipe(pasted) : undefined,
	)

	const [name, setName] = useState(
		recipe?.title ?? arrived?.title ?? defaultTitle,
	)

	const session = authClient.useSession()
	const user = session.data?.user
	// Uploads need a real account, same as avatars.
	const canAddPhoto = Boolean(user && !user.isAnonymous)
	const isDraft = !recipe?.finalizedAt
	const shared = recipe ? !recipe.owned : false

	// A pasted recipe replaces the empty fields, so they start over from it.
	const [seed, setSeed] = useState<{
		version: number
		title: string
		ingredients: string[]
		ingredientCategories?: IngredientCategories | undefined
		steps: string[]
		notes?: string | undefined
	}>({
		version: 0,
		title: recipe?.title ?? arrived?.title ?? defaultTitle,
		ingredients: recipe?.ingredients ?? arrived?.ingredients ?? [],
		ingredientCategories: recipe?.ingredientCategories,
		steps: recipe?.steps ?? arrived?.steps ?? [],
		notes: recipe?.notes ?? arrived?.notes ?? '',
	})

	const [source, setSource] = useState(recipe?.sourceUrl ?? '')

	const [notesTooLong, setNotesTooLong] = useState(
		() =>
			Array.from((recipe?.notes ?? arrived?.notes ?? '').trim()).length >
			recipeNotesMax,
	)

	// Read from the fields, not from `contentFrom`, which gives up without a name
	// and would call a form with typed rows empty.
	const empty = (node: HTMLFormElement) => {
		const data = new FormData(node)

		const filled = (key: string) =>
			data
				.getAll(key)
				.map(String)
				.some((value) => value.trim() !== '')

		return !filled('ingredient') && !filled('step')
	}

	// A new recipe starts at its name; a named draft picks up at what comes next.
	useEffect(() => {
		const target = !recipe
			? '#edit-title'
			: isDraft && !recipe.ingredients.length
				? '#recipe-ingredients input:not([type=hidden])'
				: undefined

		if (target) form.current?.querySelector<HTMLElement>(target)?.focus()
	}, [recipe, isDraft])

	const announceSorted = useCallback(
		(
			sorted: ReturnType<typeof parsePastedRecipe>,
			before: { name: string; draft: string | undefined; notes: string },
		) => {
			sortedToast.current = toast(
				sortedLabel(sorted.ingredients.length, sorted.steps.length),
				{
					action: {
						label: 'undo',
						onClick: () => {
							if (finishing.current) return

							setName(before.name)
							setNotesTooLong(
								Array.from(before.notes.trim()).length > recipeNotesMax,
							)
							setSeed((current) => ({
								version: current.version + 1,
								title: before.name,
								ingredients: [],
								steps: [],
								notes: before.notes,
							}))
						},
					},
				},
			)
		},
		[],
	)

	const announcedArrival = useRef(false)
	useEffect(() => {
		if (!arrived || announcedArrival.current) return
		announcedArrival.current = true
		announceSorted(arrived, { name: defaultTitle, draft: undefined, notes: '' })
	}, [arrived, defaultTitle, announceSorted])

	// A pasted recipe is sorted at once, with a way back to the empty page.
	const sortPasted = useCallback(
		(text: string) => {
			const sorted = parsePastedRecipe(text)

			const before = {
				name,
				draft: recipeId.current,
				notes: form.current
					? formField(new FormData(form.current), 'notes')
					: '',
			}

			const mergedNotes = [before.notes, sorted.notes]
				.filter(Boolean)
				.join('\n\n')

			setName(sorted.title)
			setUnnamed(false)
			setNotesTooLong(Array.from(mergedNotes.trim()).length > recipeNotesMax)
			setSeed((current) => ({
				version: current.version + 1,
				...sorted,
				notes: mergedNotes,
			}))

			announceSorted(sorted, before)
		},
		[name, announceSorted],
	)

	// Router state can deliver a paste while this uncontrolled form stays mounted.
	const receivedPaste = useRef(pasted)
	useEffect(() => {
		if (receivedPaste.current === pasted) return
		receivedPaste.current = pasted

		if (recipe || !pasted || !form.current) return

		if (!empty(form.current) || name.trim()) {
			toast('start with an empty recipe to paste text')

			return
		}

		// Synchronize an external navigation payload with the mounted form.
		// oxlint-disable-next-line react/set-state-in-effect
		sortPasted(pasted)
	}, [pasted, recipe, name, sortPasted])

	const done = async () => {
		if (photoBusy || pending) return

		if (parseSourceInput(source) === undefined) {
			form.current?.querySelector<HTMLElement>('#edit-source')?.focus()

			return
		}

		if (notesTooLong) {
			form.current?.querySelector<HTMLElement>('#edit-notes')?.focus()

			return
		}

		const content = form.current ? contentFrom(form.current) : undefined

		if (!content) {
			setUnnamed(true)
			form.current?.querySelector<HTMLElement>('#edit-title')?.focus()

			return
		}

		setPending(true)
		setError(undefined)
		finishing.current = true

		if (sortedToast.current !== undefined) toast.dismiss(sortedToast.current)

		try {
			const saved = recipeId.current
				? await updateRecipe({
						data: { id: recipeId.current, ...content, finalize: isDraft },
					})
				: await createRecipe({
						data: {
							...content,
							imageUrl: content.imageUrl ?? undefined,
							sourceUrl: content.sourceUrl ?? undefined,
							notes: content.notes ?? undefined,
							finalized: true,
						},
					})

			if (!saved) throw new Error('not saved')
			const id = saved.id
			const latest = content

			await router.invalidate()

			// Finishing a recipe puts it on the shelf for real; that is worth saying.
			if (isDraft) toast.success(`${latest.title} is on your shelf`)
			onDone(id)
		} catch {
			finishing.current = false
			setError("couldn't save that — try again")
		} finally {
			setPending(false)
		}
	}

	const remove = async () => {
		setPending(true)

		try {
			if (recipeId.current) {
				await deleteRecipe({ data: { id: recipeId.current } })
				// The recipes tab must not send you back to it.
				forgetRecipe()
				toast.success(`${name || 'that recipe'} is off your shelf`)
			}

			await navigate({ to: '/recipes' })
		} catch {
			// Still here, so edits still have to be saved.
			setError("couldn't delete that — try again")
			setPending(false)
		}
	}

	const parsedSource = parseSourceInput(source)

	const sourceInvalid = parsedSource === undefined

	// Once an edit to a shared recipe saves, the user is editing their own copy.
	const onShared = shared && savedId === recipe?.id

	return (
		// Events from child controls and drag handles update the change summary.
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
		<form
			ref={form}
			className="flex flex-col gap-10"
			onInput={scheduleChanges}
			onChange={scheduleChanges}
			onClick={scheduleChanges}
			onPointerUp={scheduleChanges}
			onKeyUp={scheduleChanges}
			onSubmit={(event) => {
				event.preventDefault()
				void done()
			}}
		>
			<PasteRecipeDialog
				open={pasteOpen}
				onOpenChange={setPasteOpen}
				onAdd={(text) => {
					if (
						!form.current ||
						!empty(form.current) ||
						form.current
							.querySelector<HTMLTextAreaElement>('#edit-title')
							?.value.trim()
					) {
						toast('start with an empty recipe to paste text')

						return
					}

					if (/^https?:\/\/\S+$/i.test(text.trim()) && onImportLink)
						onImportLink(text.trim())
					else sortPasted(text)
				}}
			/>
			{shared ? (
				<p className="bg-kitchen-eggplant/10 border-border rounded-xl border px-4 py-3 text-sm font-semibold">
					{onShared
						? 'this recipe is shared — changing it makes your own copy. notes stay yours either way.'
						: 'editing your own copy now. the shared one stays as it was.'}
				</p>
			) : null}
			<div className="flex flex-col gap-3">
				<RecipeIntro
					photo={
						canAddPhoto ? (
							<RecipePhotoField
								current={recipe?.imageUrl}
								onBusyChange={setPhotoBusy}
							/>
						) : recipe?.imageUrl ? (
							<img
								src={recipe.imageUrl}
								alt=""
								className="border-border size-24 shrink-0 rounded-xl border object-cover"
							/>
						) : session.isPending ? (
							// Holds the slot until we know whether this account adds photos.
							<span
								aria-hidden
								className="border-input size-20 shrink-0 rounded-xl border border-dashed md:size-24"
							/>
						) : (
							<GuestPhotoSlot />
						)
					}
				>
					<RecipeNameField
						key={seed.version}
						id="edit-title"
						label="name"
						maxLength={recipeTitleMax}
						defaultValue={seed.title}
						placeholder="name it"
						errorId={unnamed && !name.trim() ? 'edit-title-error' : undefined}
						onChange={(value) => {
							setName(value)
							setUnnamed(false)
						}}
						onPaste={(event) => {
							const text = event.clipboardData.getData('text')

							if (!isPastedRecipe(text) || !form.current) return

							if (!empty(form.current)) return
							event.preventDefault()
							sortPasted(text)
						}}
					/>
					<div className="mt-3 flex min-w-0 flex-col gap-2">
						<label className={fieldLabelClassName} htmlFor="edit-source">
							original link
						</label>
						<input
							id="edit-source"
							name="sourceUrl"
							type="text"
							inputMode="url"
							autoCapitalize="none"
							autoCorrect="off"
							spellCheck={false}
							value={source}
							onChange={(event) => setSource(event.target.value)}
							aria-invalid={sourceInvalid || undefined}
							aria-describedby="edit-source-hint"
							placeholder="a web page or a youtube video"
							className={cn(fieldClassName, placeholderClassName)}
						/>
						{sourceInvalid ? (
							<FieldError id="edit-source-hint">
								that doesn&apos;t look like a web address yet
							</FieldError>
						) : (
							<p
								id="edit-source-hint"
								className="text-muted-foreground text-sm"
							>
								{parsedSource && isYouTube(parsedSource)
									? 'a video to cook along with.'
									: 'where the recipe came from, if it came from somewhere.'}
							</p>
						)}
					</div>
				</RecipeIntro>
				{!recipe && !name.trim() && !unnamed ? (
					<div className="flex flex-wrap gap-2" aria-label="start a recipe">
						{onImportLink ? (
							<button
								type="button"
								className={cn(
									quietActionClassName,
									'border-foreground/40 inline-flex items-center gap-1.5 border',
								)}
								onClick={() => {
									if (
										!form.current ||
										!empty(form.current) ||
										form.current
											.querySelector<HTMLInputElement>('#edit-title')
											?.value.trim()
									) {
										toast('start with an empty recipe to import a link')

										return
									}

									onImportLink()
								}}
							>
								<LinkSimpleIcon size={16} aria-hidden /> import link
							</button>
						) : null}
						<button
							type="button"
							className={cn(
								quietActionClassName,
								'border-foreground/40 inline-flex items-center gap-1.5 border',
							)}
							onClick={() => setPasteOpen(true)}
						>
							<ClipboardTextIcon size={16} aria-hidden /> paste text
						</button>
					</div>
				) : null}
				{unnamed && !name.trim() ? (
					<FieldError id="edit-title-error">
						give the recipe a name to finish it
					</FieldError>
				) : null}
			</div>
			<div id="recipe-ingredients">
				<IngredientListField
					key={seed.version}
					defaultValue={seed.ingredients}
					defaultCategories={seed.ingredientCategories}
					title={name}
				/>
			</div>
			<StepsField key={seed.version} defaultValue={seed.steps} />
			<div className="flex flex-col gap-2">
				<label className={fieldLabelClassName} htmlFor="edit-notes">
					notes
				</label>
				<textarea
					key={seed.version}
					id="edit-notes"
					name="notes"
					defaultValue={seed.notes ?? ''}
					onChange={(event) =>
						setNotesTooLong(
							Array.from(event.target.value.trim()).length > recipeNotesMax,
						)
					}
					aria-invalid={notesTooLong || undefined}
					aria-describedby={notesTooLong ? 'notes-too-long' : undefined}
					rows={3}
					placeholder="less salt next time"
					className={cn(fieldClassName, 'resize-y', placeholderClassName)}
				/>
				{notesTooLong ? (
					<FieldError id="notes-too-long">
						notes are too long to save — shorten them to 2,000 characters
					</FieldError>
				) : null}
			</div>
			<FormActions>
				{error ? (
					<div className="w-full">
						<FieldError>{error}</FieldError>
					</div>
				) : null}
				{changes.length ? (
					<p
						className="text-muted-foreground w-full text-sm"
						aria-live="polite"
					>
						changed: {changes.join(', ')}
					</p>
				) : null}
				<button
					type="submit"
					disabled={
						pending || photoBusy || (!changes.length && !(recipe && isDraft))
					}
					className={primaryActionClassName}
				>
					{pending ? 'saving…' : 'save'}
				</button>
				<button
					type="button"
					className={quietActionClassName}
					onClick={() =>
						recipe ? onDone(recipe.id) : void navigate({ to: '/recipes' })
					}
				>
					cancel
				</button>
				<span className="ml-auto flex gap-2">
					{onShared && !recipe?.saved ? null : (
						<button
							type="button"
							disabled={pending}
							onClick={() =>
								savedId ? setConfirmingDelete(true) : void remove()
							}
							className={buttonVariants({ variant: 'destructive', size: 'lg' })}
						>
							<TrashIcon size={16} aria-hidden />
							{onShared || savedId ? 'delete' : 'discard'}
						</button>
					)}
				</span>
			</FormActions>
			<DeleteRecipeDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={name}
				shared={onShared}
				pending={pending}
				onConfirm={() => void remove()}
			/>
		</form>
	)
}
