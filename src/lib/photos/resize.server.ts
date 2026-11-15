import sharp from 'sharp'

// No cache kept between images: the server is small, and Cloudflare keeps
// what is made. One thread per image; how many images at once is `photoSlot`.
sharp.concurrency(1)

sharp.cache(false)

// A photo as WebP, no wider than `width`, turned the way its camera held it.
export function resizePhoto(bytes: Uint8Array, width: number) {
	return sharp(bytes, { limitInputPixels: 50_000_000 })
		.rotate()
		.resize({ width, withoutEnlargement: true })
		.webp({ quality: 72 })
		.toBuffer()
}

// A page full of new photos asks for them all at once, and each holds its
// full-size original while it is made. So two are made at a time and a few
// more wait; past that, null, and the browser takes the original instead.
const running = 2

const waiting = 16

let busy = 0

const queue: (() => void)[] = []

export async function photoSlot<T>(job: () => Promise<T>): Promise<T | null> {
	if (busy >= running) {
		if (queue.length >= waiting) return null
		await new Promise<void>((resolve) => queue.push(resolve))
	}

	busy += 1

	try {
		return await job()
	} finally {
		busy -= 1
		queue.shift()?.()
	}
}
