// The widths a recipe's photo is drawn at: a tile or a finder row, and the
// recipe's own page, each at twice its size for sharp screens. Few, so each
// is resized once and kept by browsers and Cloudflare.
export const photoWidths = [400, 800] as const

export type PhotoWidth = (typeof photoWidths)[number]

// A photo from a recipe's site, sized for where it is drawn. The site's
// original is often a megabyte or more for a tile 180 pixels wide.
// Uploaded photos already live at an address of our own, and stay as they are.
export function sizedPhoto(url: string, width: PhotoWidth) {
	return /^https?:\/\//i.test(url)
		? `/api/img?w=${width}&u=${encodeURIComponent(url)}`
		: url
}
