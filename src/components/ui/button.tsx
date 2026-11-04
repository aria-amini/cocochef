import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/ui'

// One button family for every screen: basil for the one primary action, paper
// with a field line for the rest, 8px corners, semibold lowercase labels, and
// the eggplant focus outline.
const buttonStyles = cva(
	"group/button focus-visible:outline-kitchen-eggplant inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: 'bg-kitchen-basil text-foreground hover:brightness-95',
				outline: 'border-input bg-background hover:bg-muted/60',
				ghost: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
				destructive: 'bg-kitchen-tomato/20 hover:bg-kitchen-tomato/30',
			},
			size: {
				default: 'min-h-10 px-4 py-2',
				lg: 'min-h-11 px-6 py-3',
				'icon-sm': 'size-8',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

// Merged, so a variant's border color wins over the base's transparent one
// wherever the classes land on a plain element.
function buttonVariants(...args: Parameters<typeof buttonStyles>) {
	return cn(buttonStyles(...args))
}

function Button({
	className,
	variant = 'default',
	size = 'default',
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonStyles>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={buttonVariants({ variant, size, className })}
			{...props}
		/>
	)
}

export { Button, buttonVariants }
