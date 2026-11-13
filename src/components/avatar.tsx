import { cn } from '@/lib/utils/ui'

// One avatar everywhere, so the fallback never looks like a different thing
// from place to place: the photo when there is one, otherwise a yolk initial.
const sizes = {
	sm: 'size-6 rounded-md text-xs',
	md: 'size-8 rounded-md text-sm',
	lg: 'size-10 rounded-md text-base',
	xl: 'size-24 rounded-xl text-3xl',
} as const

export function Avatar({
	name,
	src,
	size,
	alt = '',
	className,
}: {
	name: string
	src?: string | null | undefined
	size: keyof typeof sizes
	alt?: string
	className?: string
}) {
	const box = sizes[size]

	if (src) {
		return (
			<img
				src={src}
				alt={alt}
				className={cn(
					'border-border shrink-0 border object-cover',
					box,
					className,
				)}
			/>
		)
	}

	return (
		<span
			aria-hidden
			className={cn(
				'border-border grid shrink-0 place-items-center border font-bold',
				'bg-kitchen-yolk',
				box,
				className,
			)}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	)
}
