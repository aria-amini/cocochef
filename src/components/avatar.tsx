import { UserIcon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils/ui'

// One avatar everywhere, so the fallback never looks like a different thing
// from place to place: the photo when there is one, a yolk initial for an
// account, a dashed outline for a guest whose shelf is not saved yet.
const sizes = {
	sm: { box: 'size-6 rounded-md text-xs', icon: 14 },
	md: { box: 'size-8 rounded-md text-sm', icon: 16 },
	lg: { box: 'size-10 rounded-md text-base', icon: 22 },
	xl: { box: 'size-24 rounded-xl text-3xl', icon: 44 },
} as const

export function Avatar({
	name,
	src,
	guest = false,
	size,
	alt = '',
	className,
}: {
	name: string
	src?: string | null | undefined
	guest?: boolean
	size: keyof typeof sizes
	alt?: string
	className?: string
}) {
	const { box, icon } = sizes[size]

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
				guest ? 'bg-card border-dashed' : 'bg-kitchen-yolk',
				box,
				className,
			)}
		>
			{guest ? (
				<UserIcon size={icon} weight="bold" />
			) : (
				name.charAt(0).toUpperCase()
			)}
		</span>
	)
}
