import {
	LinkSimpleIcon,
	PencilSimpleIcon,
	Plus,
	YoutubeLogoIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'

import { FieldError, fieldLabelClassName } from '@/components/recipe-form'
import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { hostOf, isYouTube, parseSourceInput } from '@/lib/recipes/source'
import { cn } from '@/lib/utils/ui'

const chipClassName =
	'border-input text-muted-foreground hover:text-foreground hover:bg-card inline-flex min-h-9 max-w-full items-center gap-1.5 self-start rounded-md border px-2.5 text-sm font-semibold transition-colors'

// Where the recipe came from, kept small under its name: a chip that says
// where, or offers to add it. It opens into the field to change it, and stays
// open while what is typed is not an address yet.
export function SourceLinkField({
	value,
	onChange,
}: {
	value: string
	onChange: (value: string) => void
}) {
	const [open, setOpen] = useState(false)
	const parsed = parseSourceInput(value)
	const invalid = parsed === undefined

	if (!open && !invalid) {
		const youtube = parsed ? isYouTube(parsed) : false

		return (
			<>
				<input type="hidden" name="sourceUrl" value={value} />
				<button
					type="button"
					aria-label={parsed ? 'edit original link' : 'add original link'}
					onClick={() => setOpen(true)}
					className={chipClassName}
				>
					{parsed ? (
						<>
							{youtube ? (
								<YoutubeLogoIcon size={16} aria-hidden className="shrink-0" />
							) : (
								<LinkSimpleIcon size={16} aria-hidden className="shrink-0" />
							)}
							<span className="truncate">
								{youtube ? 'youtube video' : hostOf(parsed)}
							</span>
							<PencilSimpleIcon size={12} aria-hidden className="shrink-0" />
						</>
					) : (
						<>
							<Plus size={12} weight="bold" aria-hidden />
							original link
						</>
					)}
				</button>
			</>
		)
	}

	return (
		<div className="flex min-w-0 flex-col gap-2">
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
				// Opened on purpose, so typing starts here.
				// oxlint-disable-next-line jsx-a11y/no-autofocus
				autoFocus={open}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onBlur={() => setOpen(false)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === 'Escape') {
						event.preventDefault()

						if (!invalid) setOpen(false)
					}
				}}
				aria-invalid={invalid || undefined}
				aria-describedby="edit-source-hint"
				placeholder="a web page or a youtube video"
				className={cn(fieldClassName, placeholderClassName)}
			/>
			{invalid ? (
				<FieldError id="edit-source-hint">
					that doesn&apos;t look like a web address yet
				</FieldError>
			) : (
				<p id="edit-source-hint" className="text-muted-foreground text-sm">
					{parsed && isYouTube(parsed)
						? 'a video to cook along with.'
						: 'where the recipe came from, if it came from somewhere.'}
				</p>
			)}
		</div>
	)
}
