/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events --
   APG combobox popup: listbox/option roles on ul/li are the correct pattern;
   a native datalist cannot style or fully control the suggestion list. Focus
   stays in the input, which handles the keys, so options need no key events. */
import { useId, useRef, useState } from 'react'

import { placeholderClassName } from '@/components/recipe-form'
import { pantrySprites, resolveSpriteSrc } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

const ingredients = [
	...new Set(pantrySprites.flatMap((entry) => entry.aliases)),
]

function suggest(query: string): string[] {
	const normalized = query.trim().toLowerCase()

	if (!normalized) return []

	return ingredients
		.filter((ingredient) => ingredient.startsWith(normalized))
		.slice(0, 6)
}

// A whole ingredient line ("2 cloves garlic") is completed by its name alone.
export type LineCompletion = {
	// The part of the value suggestions match against.
	query: (value: string) => string
	// The value with that part swapped for the picked suggestion.
	apply: (value: string, suggestion: string) => string
}

export function IngredientCombobox({
	id,
	value,
	onChange,
	name = 'name',
	required = true,
	placeholder = 'carrots',
	label,
	compact = false,
	bare = false,
	maxLength = 80,
	completion,
	inputRef,
	onKeyDown,
	onPaste,
}: {
	id?: string
	value: string
	onChange: (name: string) => void
	name?: string
	required?: boolean
	placeholder?: string
	label?: string
	compact?: boolean
	// Drops the field's own border and fill and anchors the suggestions to the
	// nearest positioned ancestor, for a field that lives inside a row.
	bare?: boolean
	maxLength?: number
	completion?: LineCompletion | undefined
	inputRef?: React.Ref<HTMLTextAreaElement>
	// Runs for keys the suggestion list does not handle.
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>
}) {
	const listboxId = useId()
	const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const query = completion ? completion.query(value) : value
	const suggestions = suggest(query)

	// A lone suggestion the field already spells out has nothing left to offer.
	const settled =
		suggestions.length === 1 && suggestions[0] === query.trim().toLowerCase()

	const expanded = open && suggestions.length > 0 && !settled

	function pick(suggestion: string) {
		onChange(completion ? completion.apply(value, suggestion) : suggestion)
		setOpen(false)
		setActiveIndex(-1)
	}

	function handleListKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			setActiveIndex((index) => Math.max(index - 1, -1))
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault()
			const suggestion = suggestions[activeIndex]

			if (suggestion) pick(suggestion)
		} else if (event.key === 'Escape') {
			// Closing the list is all this press does.
			event.preventDefault()
			setOpen(false)
			setActiveIndex(-1)
		}
	}

	return (
		<div className={bare ? undefined : 'relative'}>
			{/* A textarea so a long line wraps where it can be read; it never
			    takes a line break. */}
			<textarea
				ref={inputRef}
				rows={1}
				id={id}
				name={name}
				required={required}
				aria-label={label}
				maxLength={maxLength}
				value={value}
				role="combobox"
				aria-expanded={expanded}
				aria-controls={listboxId}
				aria-activedescendant={
					expanded && activeIndex >= 0
						? `${listboxId}-${activeIndex}`
						: undefined
				}
				aria-autocomplete="list"
				autoComplete="off"
				placeholder={placeholder}
				onChange={(event) => {
					onChange(event.target.value.replaceAll(/\s*\n\s*/g, ' '))
					setOpen(true)
					setActiveIndex(-1)
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => {
					blurTimeout.current = setTimeout(() => setOpen(false), 150)
				}}
				onPaste={onPaste}
				onKeyDown={(event) => {
					// Enter and arrows belong to the input method while it composes.
					if (event.nativeEvent.isComposing || event.keyCode === 229) return

					if (expanded) handleListKey(event)
					else if (
						event.key === 'ArrowDown' &&
						suggestions.length > 0 &&
						!settled
					) {
						event.preventDefault()
						setOpen(true)
						setActiveIndex(0)
					}

					if (!event.defaultPrevented) onKeyDown?.(event)
				}}
				className={cn(
					'field-sizing-content block w-full resize-none',
					bare
						? 'bg-transparent px-3 py-2.5 text-base font-medium outline-none'
						: 'border-input bg-card focus-visible:outline-kitchen-eggplant rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2',
					placeholderClassName,
					!bare &&
						(compact
							? 'px-3 py-2 text-sm font-semibold'
							: 'px-3 py-3 text-lg font-semibold'),
				)}
			/>
			{expanded ? (
				<ul
					id={listboxId}
					role="listbox"
					aria-label="Ingredient suggestions"
					className="bg-card border-foreground/30 absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border shadow-md"
				>
					{suggestions.map((suggestion, index) => (
						<li
							key={suggestion}
							id={`${listboxId}-${index}`}
							role="option"
							aria-selected={index === activeIndex}
							// Holding the press keeps focus; the click picks.
							onMouseDown={(event) => {
								event.preventDefault()
								clearTimeout(blurTimeout.current)
							}}
							onClick={() => pick(suggestion)}
							onMouseEnter={() => setActiveIndex(index)}
							className={cn(
								'flex cursor-pointer items-center gap-3 px-3 py-2 font-semibold',
								index === activeIndex && 'bg-kitchen-yolk/40',
							)}
						>
							<img
								src={resolveSpriteSrc(suggestion)}
								alt=""
								className="size-8 object-contain [image-rendering:pixelated]"
							/>
							{suggestion}
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}
