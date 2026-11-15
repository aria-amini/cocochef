import sharp from 'sharp'

// One image at a time, and no cache kept between them: the server is small,
// and Cloudflare keeps what is made.
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
