import { cn } from '@/lib/utils/ui'

/**
 * coco, the mascot, waving. The image is a six-frame strip; `object-cover` shows
 * one frame and the animation slides along it. Reduced motion holds frame one.
 */
export function CocoWave({ className }: { className?: string }) {
	return (
		<img
			src="/sprites/coco/wave.webp"
			alt="coco, a black cat in a chef's hat, waving"
			width={400}
			height={484}
			className={cn(
				'animate-coco-wave aspect-[400/484] object-cover object-left motion-reduce:animate-none',
				className,
			)}
		/>
	)
}
