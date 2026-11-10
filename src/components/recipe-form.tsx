import { WarningCircleIcon } from '@phosphor-icons/react'

import { buttonVariants } from '@/components/ui/button'
import { placeholderClassName } from '@/components/ui/input'
import { cn } from '@/lib/utils/ui'

// Section headings inside a recipe form: one step above the fields they name.
export const fieldLabelClassName = 'text-base font-bold'

// The quiet name over a part of the recipe (ingredients, steps, notes): a
// label, so what is written under it stays the boldest thing there.
export const sectionLabelClassName = 'text-muted-foreground text-sm font-bold'

// The line under a section heading that says how the section works.
export const fieldHintClassName = 'text-muted-foreground text-sm'

// The photo slot beside the recipe's name: the two things that say what this
// recipe is, side by side at the top of the form and centred on each other.
// What it links to sits in a row under both, so the row can grow.
export function RecipeIntro({
	photo,
	links,
	children,
}: {
	photo?: React.ReactNode
	links?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<fieldset
			aria-label="about the recipe"
			className="flex min-w-0 flex-col gap-3"
		>
			<div className="flex items-center gap-4">
				{photo}
				<div className="min-w-0 flex-1">{children}</div>
			</div>
			{links}
		</fieldset>
	)
}

// The recipe's name, written where the page shows it: the same size as the
// recipe's heading, on a dashed line while empty or being written, and plain
// once written. A long name wraps
// like the heading does, but stays one line: enter moves on to what comes
// next, never saving a recipe that has only its name.
export function RecipeNameField({
	label,
	id,
	defaultValue,
	placeholder,
	maxLength,
	errorId,
	onChange,
	onPaste,
	onEnter,
}: {
	label: string
	id?: string
	defaultValue?: string
	placeholder?: string
	maxLength: number
	// The message under the field while the name is missing.
	errorId?: string | undefined
	onChange?: (value: string) => void
	onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
	onEnter?: () => void
}) {
	return (
		<textarea
			id={id}
			name="title"
			rows={1}
			aria-label={label}
			aria-invalid={errorId ? true : undefined}
			aria-describedby={errorId}
			maxLength={maxLength}
			defaultValue={defaultValue}
			placeholder={placeholder}
			autoComplete="off"
			enterKeyHint="next"
			onChange={(event) => {
				// A pasted name can carry line breaks the field won't show.
				const value = event.target.value.replaceAll(/\s*\n\s*/g, ' ')

				if (value !== event.target.value) event.target.value = value
				onChange?.(value)
			}}
			onKeyDown={(event) => {
				if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
				event.preventDefault()
				onEnter?.()
			}}
			onPaste={onPaste}
			className={cn(
				'border-input focus-visible:border-kitchen-eggplant aria-invalid:border-kitchen-tomato field-sizing-content',
				// Once written and left, it reads as the recipe's heading; a tap
				// writes it again.
				'not-placeholder-shown:not-focus:not-aria-invalid:hover:border-input not-placeholder-shown:not-focus:not-aria-invalid:border-transparent',
				' w-full min-w-0 resize-none border-b border-dashed bg-transparent pb-2 text-4xl leading-tight font-bold tracking-tight outline-none focus-visible:border-b-2 focus-visible:border-solid md:text-5xl',
				placeholderClassName,
			)}
		/>
	)
}

// What went wrong, in ink so it reads, with a tomato mark so it is seen.
export function FieldError({
	id,
	children,
}: {
	id?: string
	children: React.ReactNode
}) {
	return (
		<p
			id={id}
			role="alert"
			className="flex items-start gap-1.5 text-sm font-semibold"
		>
			<WarningCircleIcon
				size={18}
				weight="fill"
				aria-hidden
				className="text-kitchen-tomato shrink-0"
			/>
			{children}
		</p>
	)
}

// Keep recipe actions in reach at the bottom while the form scrolls: a pill
// floating over the page, only as wide as what it holds, so it never reads as
// more of the form. What is not saved yet sits at its start, the actions at
// its end.
export function FormActions({
	status,
	children,
}: {
	status?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<div className="pb-bar pointer-events-none sticky bottom-0 z-10 flex justify-center pt-3">
			<div className="bg-card border-border pointer-events-auto flex max-w-full items-center gap-1 rounded-full border p-1.5 shadow-xl">
				{status ? (
					<div className="text-muted-foreground min-w-0 truncate pr-2 pl-4 text-sm">
						{status}
					</div>
				) : null}
				{children}
			</div>
		</div>
	)
}

// The dock's own buttons: round, like the pill they sit in.
export const dockActionClassName = buttonVariants({
	variant: 'ghost',
	className: 'rounded-full',
})

export const dockSaveClassName = buttonVariants({
	className: 'rounded-full px-6',
})

export const primaryActionClassName = buttonVariants({ size: 'lg' })
