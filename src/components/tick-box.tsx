import { CheckIcon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils/ui'

// A round tick for something bought: a hairline circle, filled with a basil
// tint once ticked. The tick is drawn, not a font's glyph, so it looks the
// same on every phone.
export function TickBox({
	className,
	...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
	return (
		<span
			className={cn(
				'relative grid size-6 shrink-0 place-items-center',
				className,
			)}
		>
			<input
				type="checkbox"
				className="border-foreground/40 checked:bg-kitchen-basil/30 checked:border-kitchen-basil peer size-6 cursor-pointer appearance-none rounded-full border-2 transition-colors"
				{...props}
			/>
			<CheckIcon
				size={14}
				weight="bold"
				aria-hidden
				className="pointer-events-none absolute opacity-0 transition-opacity peer-checked:opacity-100"
			/>
		</span>
	)
}
