import { z } from 'zod'

const webUrl = z.url({ protocol: /^https?$/ }).max(2000)

// A link typed or pasted by hand. Empty clears it (null). No scheme means
// https, so "youtube.com/watch?v=…" works. Anything that is not a web address
// is undefined, which the editor treats as "not a link yet" and leaves alone.
export function parseSourceInput(raw: string): string | null | undefined {
	const text = raw.trim()

	if (!text) return null

	const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(text)
		? text
		: `https://${text}`

	// A bare word is not an address, even with a scheme in front of it.
	if (!/^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(candidate)) return undefined

	const parsed = webUrl.safeParse(candidate)

	return parsed.success ? parsed.data : undefined
}

export function hostOf(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return url
	}
}

export function isYouTube(url: string) {
	const host = hostOf(url)

	return host === 'youtu.be' || /(^|\.)youtube\.com$/.test(host)
}
