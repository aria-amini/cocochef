import { ImageSquare, X } from '@phosphor-icons/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { getRecipePhotoUploadUrl } from '@/lib/s3'
import { cn } from '@/lib/utils/ui'

const maxBytes = 10 * 1024 * 1024

// Stands where the photo field would for a guest, who can't upload: the slot
// says why and links to sign-in, which returns here, instead of vanishing.
export function GuestPhotoSlot() {
	const location = useLocation()

	return (
		<Link
			to="/auth/login"
			search={{ redirect: location.href }}
			className="border-input bg-background hover:bg-card text-foreground/60 grid size-20 shrink-0 place-items-center rounded-xl border border-dashed p-1 md:size-24"
		>
			<span className="flex flex-col items-center gap-1 text-center text-xs font-semibold">
				<ImageSquare size={28} weight="duotone" aria-hidden />
				sign in to add a photo
			</span>
		</Link>
	)
}

// Shows `current` (an imported or saved photo) until the user picks another.
// Uploads on pick, then submits the storage key as the form's `imageUrl`. An
// untouched field submits nothing, and a removed photo submits an empty value.
export function RecipePhotoField({
	current,
	onBusyChange,
}: {
	current?: string | null | undefined
	onBusyChange: (busy: boolean) => void
}) {
	const [photo, setPhoto] = useState<{ key: string; preview: string }>()
	const [removed, setRemoved] = useState(false)
	const [busy, setBusy] = useState(false)
	const shown = photo?.preview ?? (removed ? undefined : (current ?? undefined))

	useEffect(() => {
		const preview = photo?.preview

		return () => {
			if (preview) URL.revokeObjectURL(preview)
		}
	}, [photo])

	function updateBusy(next: boolean) {
		setBusy(next)
		onBusyChange(next)
	}

	async function choose(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]
		event.target.value = ''

		if (!file) return

		if (file.size > maxBytes) {
			toast.error('that photo is over 10 MB — pick a smaller one')

			return
		}

		updateBusy(true)

		try {
			const { key, url } = await getRecipePhotoUploadUrl()

			const response = await fetch(url, {
				method: 'PUT',
				headers: { 'Content-Type': file.type },
				body: file,
			})

			if (!response.ok) {
				const detail = (await response.text()).slice(0, 300)

				throw new Error(`Photo upload failed (${response.status}): ${detail}`)
			}

			setPhoto({ key, preview: URL.createObjectURL(file) })
		} catch (error) {
			Sentry.captureException(error, {
				tags: { upload: 'recipe-photo' },
				extra: { type: file.type, size: file.size },
			})
			toast.error("couldn't upload that photo — try again")
		} finally {
			updateBusy(false)
		}
	}

	return (
		<div className="relative size-20 shrink-0 md:size-24">
			<label
				className={cn(
					'border-input bg-background focus-within:outline-kitchen-eggplant hover:bg-card grid size-full cursor-pointer place-items-center overflow-hidden rounded-xl border focus-within:outline-2 focus-within:outline-offset-2',
					!shown && 'border-dashed',
					busy && 'animate-pulse',
				)}
			>
				<input
					type="file"
					accept="image/*"
					aria-label="Recipe photo"
					disabled={busy}
					onChange={choose}
					className="sr-only"
				/>
				{shown ? (
					<img src={shown} alt="" className="size-full object-cover" />
				) : (
					<span className="text-foreground/60 flex flex-col items-center gap-1 text-xs font-semibold">
						{busy ? (
							'uploading…'
						) : (
							<>
								<ImageSquare size={28} weight="duotone" aria-hidden />
								add photo
							</>
						)}
					</span>
				)}
			</label>
			{shown ? (
				<button
					type="button"
					aria-label="Remove photo"
					onClick={() => {
						setPhoto(undefined)
						setRemoved(true)
					}}
					className="border-border bg-background absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border"
				>
					<X size={12} weight="bold" aria-hidden />
				</button>
			) : null}
			{photo || removed ? (
				<input type="hidden" name="imageUrl" value={photo?.key ?? ''} />
			) : null}
		</div>
	)
}
