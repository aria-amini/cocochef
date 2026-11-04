// Kept apart from fetch.ts, which imports Vite-only ?raw assets that the data
// scripts (run with vpx, under plain Node) cannot load.
const DECOY_MARKERS = [
	'just a moment',
	'cf-chl',
	'challenge-platform',
	'px-captcha',
	'datadome',
	'are you a robot',
	'verify you are human',
	'enable javascript and cookies',
]

export function isWalled(status: number, html: string) {
	if (status === 401 || status === 403) return true
	const sample = html.slice(0, 50_000).toLowerCase()

	return DECOY_MARKERS.some((marker) => sample.includes(marker))
}
