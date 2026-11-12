import { lookup } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import type { ReadableStream } from 'node:stream/web'

import { Agent, fetch } from 'undici'

import { isWalled } from './wall'

// Fetching a page on the open web, and only there: every hop, redirects
// included, must resolve to a public address, and the connection is pinned to
// the address checked. Kept apart from the importer's other tiers so a script
// can use it without the bundled Python fetcher.

const MAX_REDIRECTS = 5

export const MAX_HTML_BYTES = 4 * 1024 * 1024

const BROWSER_HEADERS = {
	'user-agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	accept:
		'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
	'accept-language': 'en-US,en;q=0.9',
	'upgrade-insecure-requests': '1',
	'sec-fetch-dest': 'document',
	'sec-fetch-mode': 'navigate',
	'sec-fetch-site': 'none',
	'sec-fetch-user': '?1',
}

function isPrivateIpv4(ip: string) {
	const [a = 0, b = 0, c = 0] = ip.split('.').map(Number)

	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113) ||
		a >= 224
	)
}

type Hextets = [number, number, number, number, number, number, number, number]

function expandIpv6(ip: string): Hextets {
	const [head = '', tail = ''] = ip.split('::')

	const parseGroup = (group: string): number[] => {
		if (!group.includes('.')) return [Number.parseInt(group, 16)]

		const [a = 0, b = 0, c = 0, d = 0] = group
			.slice(group.lastIndexOf(':') + 1)
			.split('.')
			.map(Number)

		return [(a << 8) | b, (c << 8) | d]
	}

	const groups = (side: string): number[] =>
		side === '' ? [] : side.split(':').flatMap(parseGroup)

	const headGroups = groups(head)
	const tailGroups = ip.includes('::') ? groups(tail) : []
	const fill = 8 - headGroups.length - tailGroups.length

	const all = [
		...headGroups,
		...Array<number>(Math.max(fill, 0)).fill(0),
		...tailGroups,
	]

	return [
		all[0]!,
		all[1]!,
		all[2]!,
		all[3]!,
		all[4]!,
		all[5]!,
		all[6]!,
		all[7]!,
	]
}

function embeddedIpv4(hextets: Hextets) {
	return `${hextets[6] >> 8}.${hextets[6] & 0xff}.${hextets[7] >> 8}.${hextets[7] & 0xff}`
}

export function isPrivateIp(ip: string) {
	const version = isIP(ip)

	if (version === 4) return isPrivateIpv4(ip)

	if (version === 6) {
		const lower = ip.toLowerCase()

		const trimmed = lower
			.split(':')
			.filter((group) => group !== '' && group !== '0')

		if (trimmed.length === 0) return true

		if (trimmed.length === 1 && trimmed[0] === '1' && !lower.includes('.'))
			return true
		const hextets = expandIpv6(lower)
		const first = hextets[0]

		if (first >= 0xff00) return true

		if (first === 0x2001 && hextets[1] === 0x0db8) return true

		if (first >= 0xfc00 && first <= 0xfdff) return true

		if (first >= 0xfe80 && first <= 0xfeff) return true

		if (first === 0x2002)
			return isPrivateIpv4(
				`${hextets[1] >> 8}.${hextets[1] & 0xff}.${hextets[2] >> 8}.${hextets[2] & 0xff}`,
			)

		if (first === 0x64 && hextets[1] === 0xff9b)
			return isPrivateIpv4(embeddedIpv4(hextets))
		const leadingZero = hextets.slice(0, 5).every((hextet) => hextet === 0)

		if (leadingZero && hextets[5] === 0xffff)
			return isPrivateIpv4(embeddedIpv4(hextets))

		if (leadingZero && hextets[5] === 0)
			return isPrivateIpv4(embeddedIpv4(hextets))

		return false
	}

	return true
}

export type PinnedTarget = {
	url: URL
	hostname: string
	address: string
}

export async function assertPublicHttpUrl(raw: string): Promise<PinnedTarget> {
	const url = new URL(raw)

	if (url.protocol !== 'http:' && url.protocol !== 'https:')
		throw new Error(`unsupported scheme: ${url.protocol}`)
	const hostname = url.hostname.replace(/^\[|\]$/g, '')

	if (!hostname) throw new Error('missing hostname')

	if (isIP(hostname)) {
		if (isPrivateIp(hostname)) throw new Error(`private address: ${hostname}`)

		return { url, hostname, address: hostname }
	}

	const addresses = await lookup(hostname, { all: true })

	if (addresses.length === 0) throw new Error(`unresolvable host: ${hostname}`)

	for (const { address } of addresses)
		if (isPrivateIp(address)) throw new Error(`private address: ${hostname}`)
	const address = addresses[0]?.address

	if (!address) throw new Error(`unresolvable host: ${hostname}`)

	return { url, hostname, address }
}

// Pins the connection to the address validated above; without this, a second
// DNS resolution at connect time could race back to a private address (DNS
// rebinding). The hostname stays in the URL so Host/SNI are untouched.
// Answers the connection's address lookup with the address checked above,
// and nothing else.
export function pinnedLookup(target: PinnedTarget): LookupFunction {
	return (hostname, options, callback) => {
		const address = hostname === target.hostname ? target.address : ''

		if (!address || isPrivateIp(address)) {
			callback(new Error(`refusing connection to ${hostname}`), '', 4)

			return
		}

		const family = isIP(address)

		// Node asks for every address when it races IPv4 and IPv6, which it does
		// by default; it then expects a list, not one address.
		if (options.all) callback(null, [{ address, family }])
		else callback(null, address, family)
	}
}

function pinnedDispatcher(target: PinnedTarget) {
	return new Agent({ connect: { lookup: pinnedLookup(target) } })
}

async function readHtmlBody(response: { body: ReadableStream | null }) {
	if (!response.body) return ''
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let received = 0

	for (;;) {
		const { done, value } = await reader.read()

		if (done) break
		received += value.byteLength

		if (received > MAX_HTML_BYTES) {
			await reader.cancel()

			return null
		}

		chunks.push(value)
	}

	const bytes = new Uint8Array(received)
	let offset = 0

	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.byteLength
	}

	return new TextDecoder().decode(bytes)
}

export async function fetchPlain(rawUrl: string) {
	let url = rawUrl

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const target = await assertPublicHttpUrl(url)
		const dispatcher = pinnedDispatcher(target)

		try {
			const response = await fetch(target.url, {
				headers: BROWSER_HEADERS,
				redirect: 'manual',
				signal: AbortSignal.timeout(15_000),
				dispatcher,
			})

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('location')
				await response.body?.cancel()

				if (!location) return null
				url = new URL(location, target.url).toString()
				continue
			}

			const contentType = response.headers.get('content-type') ?? ''

			if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
				await response.body?.cancel()

				return null
			}

			const html = await readHtmlBody(response)

			if (html === null) return null

			if (isWalled(response.status, html)) return null

			if (!response.ok) return null

			return { html, url: target.url.toString() }
		} finally {
			await dispatcher.close()
		}
	}

	return null
}
