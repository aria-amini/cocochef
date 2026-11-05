import { useState } from 'react'

import { cn } from '@/lib/utils/ui'

/**
 * coco, the mascot, waving. The image is a six-frame strip; `object-cover` shows
 * one frame and the animation slides along it. Coco waves on arrival and again
 * when greeted, so nothing on the page moves for long. Reduced motion holds
 * frame one.
 */
export function CocoWave({ className }: { className?: string }) {
	const [waving, setWaving] = useState(true)

	return (
		<button
			type="button"
			aria-label="wave at coco, a black cat in a chef's hat"
			onClick={() => setWaving(true)}
			onPointerEnter={() => setWaving(true)}
			onAnimationEnd={() => setWaving(false)}
			className={cn('block cursor-default rounded-xl', className)}
		>
			<img
				src="/sprites/coco/wave.webp"
				alt=""
				width={400}
				height={484}
				className={cn(
					'aspect-[400/484] w-full object-cover object-left',
					waving && 'animate-coco-wave motion-reduce:animate-none',
				)}
			/>
		</button>
	)
}
