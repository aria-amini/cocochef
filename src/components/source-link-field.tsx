import {
	LinkSimpleIcon,
	PencilSimpleIcon,
	Plus,
	YoutubeLogoIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'

import { FieldError, fieldLabelClassName } from '@/components/recipe-form'
import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { recipeLinksMax } from '@/lib/recipes/model'
import { hostOf, isYouTube, parseSourceInput } from '@/lib/recipes/source'
import { cn } from '@/lib/utils/ui'

const chipClassName =
	'border-input text-muted-foreground hover:text-foreground hover:bg-card inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold transition-colors'

// What a recipe links to, kept small under its name: the page or video it came
// from first, then any others, each a chip that opens into a field to change
// it, and one more chip to add the next.
export function SourceLinkField({
	value,
	onChange,
	links,
	onLinksChange,
}: {
	value: string
	onChange: (value: string) => void
	links: string[]
	onLinksChange: (links: string[]) => void
}) {
	// The link just added opens to be typed into.
	const [added, setAdded] = useState<number>()

	const setLink = (at: number, next: string) =>
		onLinksChange(links.map((link, index) => (index === at ? next : link)))

	return (
		<div className="flex min-w-0 flex-wrap items-start gap-2">
			<LinkChip
				id="edit-source"
				name="sourceUrl"
				label="original link"
				hint="where the recipe came from, if it came from somewhere."
				value={value}
				onChange={onChange}
			/>
			{links.map((link, index) => (
				<LinkChip
					// Links have no identity but their place in the row.
					// oxlint-disable-next-line react/no-array-index-key
					key={index}
					id={`edit-link-${index}`}
					name="link"
					label="link"
					hint="another page or a video for this recipe."
					value={link}
					startOpen={added === index}
					onChange={(next) => setLink(index, next)}
					// A link emptied and left goes away.
					onLeave={() => {
						setAdded(undefined)

						if (!link.trim())
							onLinksChange(links.filter((_, at) => at !== index))
					}}
				/>
			))}
			{value.trim() && links.length < recipeLinksMax ? (
				<button
					type="button"
					aria-label="add another link"
					onClick={() => {
						setAdded(links.length)
						onLinksChange([...links, ''])
					}}
					className={chipClassName}
				>
					<Plus size={12} weight="bold" aria-hidden />
					link
				</button>
			) : null}
		</div>
	)
}

// One link: a chip that says where, or offers to add it, opening into the
// field to change it. It stays open while what is typed is not an address yet.
function LinkChip({
	id,
	name,
	label,
	hint,
	value,
	startOpen = false,
	onChange,
	onLeave,
}: {
	id: string
	name: string
	label: string
	hint: string
	value: string
	startOpen?: boolean
	onChange: (value: string) => void
	onLeave?: () => void
}) {
	const [open, setOpen] = useState(startOpen)
	const parsed = parseSourceInput(value)
	const invalid = parsed === undefined

	if (!open && !invalid) {
		const youtube = parsed ? isYouTube(parsed) : false

		return (
			<>
				<input type="hidden" name={name} value={value} />
				<button
					type="button"
					aria-label={parsed ? `edit ${label}` : `add ${label}`}
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
							{label}
						</>
					)}
				</button>
			</>
		)
	}

	return (
		<div className="flex w-full min-w-0 flex-col gap-2">
			<label className={fieldLabelClassName} htmlFor={id}>
				{label}
			</label>
			<input
				id={id}
				name={name}
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
				onBlur={() => {
					setOpen(false)
					onLeave?.()
				}}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === 'Escape') {
						event.preventDefault()

						if (!invalid) event.currentTarget.blur()
					}
				}}
				aria-invalid={invalid || undefined}
				aria-describedby={`${id}-hint`}
				placeholder="a web page or a youtube video"
				className={cn(fieldClassName, placeholderClassName)}
			/>
			{invalid ? (
				<FieldError id={`${id}-hint`}>
					that doesn&apos;t look like a web address yet
				</FieldError>
			) : (
				<p id={`${id}-hint`} className="text-muted-foreground text-sm">
					{parsed && isYouTube(parsed) ? 'a video to cook along with.' : hint}
				</p>
			)}
		</div>
	)
}
