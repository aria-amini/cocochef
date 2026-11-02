import * as React from 'react'

import { cn } from '@/lib/utils/ui'

// Placeholders read as hints, not values: regular weight, muted ink (≥4.5:1).
export const placeholderClassName =
	'placeholder:text-muted-foreground placeholder:font-normal'

// A filled, softly rounded field: the one look every text control shares.
export const fieldClassName =
	'border-input bg-card focus-visible:outline-kitchen-eggplant aria-invalid:border-kitchen-tomato w-full rounded-md border px-4 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'

function Input(
	{ className, ...props }: React.ComponentProps<'input'>,
	forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
	return (
		<input
			ref={forwardedRef}
			data-slot="input"
			className={cn(fieldClassName, placeholderClassName, className)}
			{...props}
		/>
	)
}

const ForwardedInput = React.forwardRef(Input)

ForwardedInput.displayName = 'Input'

export { ForwardedInput as Input }
