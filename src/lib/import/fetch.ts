import { execFile } from 'node:child_process'
import { lookup } from 'node:dns/promises'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'

import { Agent, fetch } from 'undici'
import { z } from 'zod'

import importFetchScript from '../../../scripts/import-fetch.py?raw'
import importFetchLock from '../../../scripts/import-fetch.py.lock?raw'
import { parseRecipe, type ImportedRecipe } from './parse'
import { isWalled } from './wall'

const execFileAsync = promisify(execFile)

const MAX_REDIRECTS = 5

const MAX_HTML_BYTES = 4 * 1024 * 1024

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

type PinnedTarget = {
	url: URL
	hostname: string
	address: string
}

async function assertPublicHttpUrl(raw: string): Promise<PinnedTarget> {
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
function pinnedDispatcher(target: PinnedTarget) {
	return new Agent({
		connect: {
			lookup(hostname, _options, callback) {
				const address = hostname === target.hostname ? target.address : ''

				if (!address || isPrivateIp(address)) {
					callback(new Error(`refusing connection to ${hostname}`), '', 4)

					return
				}

				callback(null, address, isIP(address))
			},
		},
	})
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

async function fetchPlain(rawUrl: string) {
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

// The script is inlined into the server bundle (?raw) and materialized to a
// temp file so the impersonated tier works identically in dev and deploys;
// it requires uv on PATH (see scripts/import-fetch.py).
let importScriptPath: Promise<string> | undefined

function resolveImportScript() {
	importScriptPath ??= (async () => {
		const dir = await mkdtemp(join(tmpdir(), 'cocochef-import-'))
		const path = join(dir, 'import-fetch.py')
		await writeFile(path, importFetchScript)
		await writeFile(`${path}.lock`, importFetchLock)

		return path
	})()
	const pending = importScriptPath
	pending.catch(() => {
		if (importScriptPath === pending) importScriptPath = undefined
	})

	return pending
}

async function fetchImpersonated(url: string) {
	try {
		const { stdout } = await execFileAsync(
			'uv',
			['run', '--locked', await resolveImportScript(), url],
			{ maxBuffer: 16 * 1024 * 1024, timeout: 60_000 },
		)

		return stdout.length > 0 ? stdout : null
	} catch (error) {
		console.warn(
			'impersonated recipe fetch failed (requires uv on PATH):',
			error instanceof Error ? error.message : error,
		)

		return null
	}
}

export type FetchedRecipePage = {
	html: string
	recipe: ImportedRecipe | null
}

// A relay on a home connection, for sites that refuse datacenter addresses.
// See relay.ts.
export type RelayConfig = { url: string; token: string }

const RELAY_TIMEOUT_MS = 75_000

const relayResponse = z.object({ html: z.string().max(MAX_HTML_BYTES) })

export async function fetchViaRelay(rawUrl: string, relay: RelayConfig) {
	try {
		const response = await fetch(new URL('/fetch', relay.url), {
			method: 'POST',
			headers: {
				authorization: `Bearer ${relay.token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({ url: rawUrl }),
			signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
		})

		if (!response.ok) {
			await response.body?.cancel()

			return null
		}

		const body = relayResponse.safeParse(await response.json())

		return body.success ? body.data.html : null
	} catch (error) {
		console.warn(
			'recipe relay failed:',
			error instanceof Error ? error.message : error,
		)

		return null
	}
}

export async function fetchRecipeHtml(
	rawUrl: string,
	relay?: RelayConfig,
): Promise<FetchedRecipePage | null> {
	await assertPublicHttpUrl(rawUrl)

	try {
		const page = await fetchPlain(rawUrl)

		if (page) {
			const recipe = parseRecipe(page.html, page.url)

			if (recipe) return { html: page.html, recipe }
		}
	} catch {
		// transport failure — fall through to the impersonated tier
	}

	const html = await fetchImpersonated(rawUrl)
	const impersonated = html ? { html, recipe: parseRecipe(html, rawUrl) } : null

	if (impersonated?.recipe || !relay) return impersonated

	const relayed = await fetchViaRelay(rawUrl, relay)

	return relayed
		? { html: relayed, recipe: parseRecipe(relayed, rawUrl) }
		: impersonated
}
