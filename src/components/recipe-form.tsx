import { WarningCircleIcon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils/ui'

// Section headings inside a recipe form: one step above the fields they name.
export const fieldLabelClassName = 'text-base font-bold'

// The line under a section heading that says how the section works.
export const fieldHintClassName = 'text-muted-foreground text-sm'

// Placeholders read as hints, not values: regular weight, muted ink (≥4.5:1).
export const placeholderClassName =
	'placeholder:text-muted-foreground placeholder:font-normal'

// A filled, softly rounded field: the one look every text control in a recipe
// form shares.
export const fieldClassName =
	'border-input bg-card focus-visible:outline-kitchen-eggplant w-full rounded-xl border px-4 py-3 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2'

// The photo slot beside the recipe's name: the two things that say what this
// recipe is, side by side at the top of the form.
export function RecipeIntro({
	photo,
	children,
}: {
	photo?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<div className="flex items-start gap-4">
			{photo}
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	)
}

// The recipe's name, written where the page shows it: the same size as the
// recipe's heading, on a dashed line until it has focus. A long name wraps
// like the heading does, but stays one line: enter finishes the recipe.
export function RecipeNameField({
	label,
	id,
	defaultValue,
	placeholder,
	maxLength,
	errorId,
	onChange,
	onPaste,
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
			enterKeyHint="done"
			onChange={(event) => {
				// A pasted name can carry line breaks the field won't show.
				const value = event.target.value.replaceAll(/\s*\n\s*/g, ' ')

				if (value !== event.target.value) event.target.value = value
				onChange?.(value)
			}}
			onKeyDown={(event) => {
				if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
				event.preventDefault()
				event.currentTarget.form?.requestSubmit()
			}}
			onPaste={onPaste}
			className={cn(
				'border-input focus-visible:border-kitchen-eggplant aria-invalid:border-kitchen-tomato field-sizing-content w-full min-w-0 resize-none border-b border-dashed bg-transparent pb-2 text-4xl leading-tight font-bold tracking-tight outline-none focus-visible:border-b-2 focus-visible:border-solid md:text-5xl',
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

// Done stays in reach on a long form: pinned to the bottom on phones, inline
// on wider screens.
export function FormActions({ children }: { children: React.ReactNode }) {
	return (
		<div className="border-border bg-background pb-bar sticky bottom-0 z-10 -mx-6 flex flex-wrap items-center gap-2 border-t px-6 pt-3 md:static md:mx-0 md:border-t-0 md:bg-transparent md:p-0">
			{children}
		</div>
	)
}

export const primaryActionClassName =
	'bg-kitchen-basil focus-visible:outline-kitchen-eggplant px-6 py-3 text-sm font-semibold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 rounded-xl'

export const quietActionClassName =
	'text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 rounded-xl'
