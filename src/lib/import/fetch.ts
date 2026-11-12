import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { fetch } from 'undici'
import { z } from 'zod'

import importFetchScript from '../../../scripts/import-fetch.py?raw'
import importFetchLock from '../../../scripts/import-fetch.py.lock?raw'
import { parseRecipe, type ImportedRecipe } from './parse'
import { assertPublicHttpUrl, fetchPlain, MAX_HTML_BYTES } from './public-fetch'

const execFileAsync = promisify(execFile)

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
