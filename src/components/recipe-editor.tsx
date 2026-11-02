import {
	CheckIcon,
	ClipboardTextIcon,
	LinkSimpleIcon,
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

import { IngredientListField } from '@/components/ingredient-list-field'
import { PasteRecipeDialog } from '@/components/paste-recipe-dialog'
import {
	FieldError,
	fieldClassName,
	fieldLabelClassName,
	FormActions,
	placeholderClassName,
	primaryActionClassName,
	quietActionClassName,
	RecipeIntro,
	RecipeNameField,
} from '@/components/recipe-form'
import { RecipePhotoField } from '@/components/recipe-photo-field'
import { StepsField, stepsFrom } from '@/components/steps-field'
import { authClient } from '@/lib/auth/client'
import { createAutosaver, type SaveState } from '@/lib/recipes/autosave'
import {
	recipeContentInput,
	recipeNotesMax,
	recipeTitleMax,
} from '@/lib/recipes/model'
import { isPastedRecipe, parsePastedRecipe } from '@/lib/recipes/paste'
import { createRecipe, deleteRecipe, updateRecipe } from '@/lib/recipes/server'
import { formField } from '@/lib/utils/form'
import { cn } from '@/lib/utils/ui'

// What the editor needs from a saved recipe; a new recipe passes none.
export type EditableRecipe = {
	id: string
	title: string
	imageUrl: string | null
	notes: string | null
	ingredients: string[]
	steps: string[]
	finalizedAt: Date | null
	// Shared recipes are never changed: the first edit makes the user a copy.
	owned: boolean
	saved: boolean
}

const saveLabels: Record<SaveState, string> = {
	saved: 'saved',
	saving: 'saving…',
	unnamed: 'give it a name to save',
	failed: "couldn't save — still trying",
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
		ingredients: data.getAll('ingredient').map(String),
		steps: stepsFrom(data),
	})

	return parsed.success ? parsed.data : undefined
}

// Nothing to lose and no save button to find. Changes reach the form as typing,
// clicks (add, remove, pick a suggestion), drags and finished photo uploads.
// While `held`, nothing saves: a photo is still uploading.
function useAutosave(
	form: React.RefObject<HTMLFormElement | null>,
	recipeId: React.RefObject<string | undefined>,
	onSaved: (recipeId: string) => void,
	held: boolean,
) {
	const router = useRouter()
	const [state, setState] = useState<SaveState>('saved')

	const [saver] = useState(() =>
		createAutosaver({
			read: () => (form.current ? contentFrom(form.current) : undefined),
			save: async (content) => {
				if (recipeId.current) {
					const saved = await updateRecipe({
						data: { id: recipeId.current, ...content },
					})

					if (!saved) throw new Error('recipe not found')
					recipeId.current = saved.id
					onSaved(saved.id)

					return
				}

				const created = await createRecipe({
					data: {
						...content,
						imageUrl: content.imageUrl ?? undefined,
						notes: content.notes ?? undefined,
						finalized: false,
					},
				})

				if (!created) throw new Error('not saved')
				recipeId.current = created.id
				onSaved(created.id)
			},
			report: setState,
		}),
	)

	// Layout cleanup runs while the form is still attached; the passive cleanup
	// below runs after React has cleared the ref.
	useLayoutEffect(() => () => saver.remember(), [saver])

	useEffect(() => {
		saver.start(recipeId.current !== undefined)

		const hide = () => {
			if (document.visibilityState === 'hidden') void saver.flush()
		}

		document.addEventListener('visibilitychange', hide)

		return () => {
			document.removeEventListener('visibilitychange', hide)
			// Leaving mid-pause still keeps the last few keystrokes.
			const before = saver.savedSnapshot()

			saver.detach()
			void saver.flush().then(() => {
				if (saver.savedSnapshot() !== before) void router.invalidate()
			})
		}
	}, [saver, router, recipeId])

	// Let go, it saves what changed while it was held.
	const wasHeld = useRef(held)

	useEffect(() => {
		saver.pause(held)

		if (wasHeld.current && !held) saver.schedule()
		wasHeld.current = held
	}, [saver, held])

	return {
		state,
		schedule: saver.schedule,
		flush: saver.flush,
		stop: saver.stop,
		resume: saver.resume,
		settle: saver.settle,
		forget: saver.forget,
	}
}

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
	const [savedId, setSavedId] = useState(recipe?.id)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string>()
	const [unnamed, setUnnamed] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	const [photoBusy, setPhotoBusy] = useState(false)
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

	const autosave = useAutosave(form, recipeId, setSavedId, photoBusy)
	const { schedule: scheduleAutosave, stop, settle, resume, forget } = autosave

	// A pasted recipe replaces the empty fields, so they start over from it.
	const [seed, setSeed] = useState({
		version: 0,
		title: recipe?.title ?? arrived?.title ?? defaultTitle,
		ingredients: recipe?.ingredients ?? arrived?.ingredients ?? [],
		steps: recipe?.steps ?? arrived?.steps ?? [],
	})

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

	// Takes the draft this editor saved back off the shelf, when what it held
	// turned out not to be a recipe after all.
	const discardDraft = useCallback(async () => {
		stop()
		await settle()
		const draft = recipeId.current

		try {
			if (draft) await deleteRecipe({ data: { id: draft } })
			recipeId.current = undefined
			forget()
			setSavedId(undefined)
		} catch {
			// Still a draft on the shelf, where it can be deleted by hand.
		} finally {
			resume()
		}
	}, [stop, settle, resume, forget])

	const announceSorted = useCallback(
		(
			sorted: ReturnType<typeof parsePastedRecipe>,
			before: { name: string; draft: string | undefined },
		) => {
			sortedToast.current = toast(
				sortedLabel(sorted.ingredients.length, sorted.steps.length),
				{
					action: {
						label: 'undo',
						onClick: () => {
							if (finishing.current) return

							setName(before.name)
							setSeed((current) => ({
								version: current.version + 1,
								title: before.name,
								ingredients: [],
								steps: [],
							}))

							if (!before.draft) void discardDraft()
							else scheduleAutosave()
						},
					},
				},
			)
		},
		[discardDraft, scheduleAutosave],
	)

	const announcedArrival = useRef(false)
	useEffect(() => {
		if (!arrived || announcedArrival.current) return
		announcedArrival.current = true
		scheduleAutosave()
		announceSorted(arrived, { name: defaultTitle, draft: undefined })
	}, [arrived, defaultTitle, scheduleAutosave, announceSorted])

	// A pasted recipe is sorted at once, with a way back to the empty page.
	const sortPasted = useCallback(
		(text: string) => {
			const sorted = parsePastedRecipe(text)
			const before = { name, draft: recipeId.current }

			setName(sorted.title)
			setUnnamed(false)
			setSeed((current) => ({ version: current.version + 1, ...sorted }))
			scheduleAutosave()

			announceSorted(sorted, before)
		},
		[name, scheduleAutosave, announceSorted],
	)

	// Router state can deliver a paste while this uncontrolled form stays mounted.
	const receivedPaste = useRef(pasted)
	useEffect(() => {
		if (receivedPaste.current === pasted) return
		receivedPaste.current = pasted

		if (recipe || !pasted || !form.current) return

		if (!empty(form.current) || name.trim()) {
			toast('Start with an empty recipe to paste text')

			return
		}

		// Synchronize an external navigation payload with the mounted form.
		// oxlint-disable-next-line react/set-state-in-effect
		sortPasted(pasted)
	}, [pasted, recipe, name, sortPasted])

	const done = async () => {
		if (photoBusy || pending) return
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
			if (!(await autosave.flush())) throw new Error('not saved')

			const id = recipeId.current

			if (!id) throw new Error('not saved')

			// Whatever was typed while the last save ran is part of what finishes.
			const latest = (form.current && contentFrom(form.current)) ?? content

			if (isDraft)
				await updateRecipe({ data: { id, ...latest, finalize: true } })

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
		autosave.stop()

		try {
			// A first save still running would create the draft after we leave.
			await autosave.settle()

			if (recipeId.current) {
				await deleteRecipe({ data: { id: recipeId.current } })
				toast.success(`${name || 'that recipe'} is off your shelf`)
			}

			await navigate({ to: '/recipes' })
		} catch {
			// Still here, so edits still have to be saved.
			autosave.resume()
			setError("couldn't delete that — try again")
			setPending(false)
		}
	}

	// Once an edit to a shared recipe saves, the user is editing their own copy.
	const onShared = shared && savedId === recipe?.id

	return (
		// Listens for changes bubbling up from every field, not for interaction.
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
		<form
			ref={form}
			className="flex flex-col gap-10"
			onInput={autosave.schedule}
			onChange={autosave.schedule}
			onClick={autosave.schedule}
			onPointerUp={autosave.schedule}
			onKeyUp={autosave.schedule}
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
						toast('Start with an empty recipe to paste text')

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
						) : null
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
										toast('Start with an empty recipe to import a link')

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
				/>
			</div>
			<StepsField key={seed.version} defaultValue={seed.steps} />
			<div className="flex flex-col gap-2">
				<label className={fieldLabelClassName} htmlFor="edit-notes">
					notes
				</label>
				<textarea
					id="edit-notes"
					name="notes"
					maxLength={recipeNotesMax}
					defaultValue={recipe?.notes ?? ''}
					rows={3}
					placeholder="less salt next time"
					className={cn(fieldClassName, 'resize-y', placeholderClassName)}
				/>
			</div>
			{error ? <FieldError>{error}</FieldError> : null}
			<FormActions>
				<button
					type="submit"
					disabled={pending || photoBusy}
					className={primaryActionClassName}
				>
					{pending ? 'saving…' : 'done'}
				</button>
				<output
					aria-live="polite"
					className={cn(
						'text-muted-foreground inline-flex items-center gap-1.5 px-2 text-sm font-semibold',
						autosave.state === 'failed' && 'text-kitchen-tomato',
					)}
				>
					{autosave.state === 'saved' && (recipe || name) ? (
						<CheckIcon size={14} weight="bold" aria-hidden />
					) : null}
					{autosave.state === 'saved' && !recipe && !name
						? null
						: isDraft && autosave.state === 'saved'
							? 'draft · saved'
							: saveLabels[autosave.state]}
				</output>
				<span className="ml-auto flex gap-2">
					{confirmingDelete ? (
						<>
							<button
								type="button"
								disabled={pending}
								onClick={() => void remove()}
								className="bg-kitchen-tomato/40 hover:bg-kitchen-tomato/60 focus-visible:outline-kitchen-eggplant rounded-md px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
							>
								{onShared ? 'really remove' : 'really delete'}
							</button>
							<button
								type="button"
								disabled={pending}
								onClick={() => setConfirmingDelete(false)}
								className={quietActionClassName}
							>
								keep it
							</button>
						</>
					) : onShared && !recipe?.saved ? null : (
						<button
							type="button"
							disabled={pending}
							onClick={() =>
								savedId ? setConfirmingDelete(true) : void remove()
							}
							className={cn(quietActionClassName, 'hover:bg-kitchen-tomato/20')}
						>
							{onShared ? 'remove from shelf' : savedId ? 'delete' : 'discard'}
						</button>
					)}
				</span>
			</FormActions>
		</form>
	)
}
