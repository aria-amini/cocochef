import * as React from 'react'

import { cn } from '@/lib/utils/ui'

function Input(
	{ className, type, ...props }: React.ComponentProps<'input'>,
	forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
	return (
		<input
			ref={forwardedRef}
			type={type}
			data-slot="input"
			className={cn(
				'h-9 w-full min-w-0 rounded-md border border-input bg-input/30 px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm',
				className,
			)}
			{...props}
		/>
	)
}

const ForwardedInput = React.forwardRef(Input)

ForwardedInput.displayName = 'Input'

export { ForwardedInput as Input }
