import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import { z } from 'zod'

import { fetchViaRelay } from './fetch'
import { createRelayServer } from './relay'

const token = 'a'.repeat(40)

const servers: ReturnType<typeof createRelayServer>[] = []

async function start(fetchPage: (url: string) => Promise<string | null>) {
	const server = createRelayServer({ token, fetchPage })
	servers.push(server)
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

	const { port } = z.object({ port: z.number() }).parse(server.address())

	return `http://127.0.0.1:${port}`
}

afterEach(() => {
	for (const server of servers.splice(0)) server.close()
})

function post(base: string, body: string, bearer = token) {
	return fetch(`${base}/fetch`, {
		method: 'POST',
		headers: { authorization: `Bearer ${bearer}` },
		body,
	})
}

const link = (url: string) => JSON.stringify({ url })

describe('relay server', () => {
	test('answers the fetched page to a caller with the token', async () => {
		const base = await start(async (url) => `<html>${url}</html>`)
		const response = await post(base, link('https://example.com/a'))

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			html: '<html>https://example.com/a</html>',
		})
	})

	test('refuses a missing or wrong token before fetching anything', async () => {
		let fetched = 0

		const base = await start(async () => {
			fetched += 1

			return 'x'
		})

		const missing = await fetch(`${base}/fetch`, {
			method: 'POST',
			body: JSON.stringify({ url: 'https://example.com' }),
		})

		const wrong = await post(base, link('https://example.com'), 'b'.repeat(40))

		expect(missing.status).toBe(401)
		expect(wrong.status).toBe(401)
		expect(fetched).toBe(0)
	})

	test('rejects bodies that are not a link', async () => {
		const base = await start(async () => 'x')

		expect((await post(base, link('ftp://example.com'))).status).toBe(400)
		expect((await post(base, JSON.stringify({ nope: true }))).status).toBe(400)
		expect((await post(base, '')).status).toBe(400)
		expect((await post(base, '{"url":')).status).toBe(400)
	})

	test('says so when the page cannot be fetched', async () => {
		const base = await start(async () => null)
		const response = await post(base, link('https://example.com'))

		expect(response.status).toBe(422)
	})

	test('serves a health check and nothing else', async () => {
		const base = await start(async () => 'x')

		expect((await fetch(`${base}/health`)).status).toBe(200)
		expect((await fetch(`${base}/other`)).status).toBe(404)
	})

	test('slows a caller who asks too often', async () => {
		const base = await start(async () => 'x')

		const statuses: number[] = []

		for (let call = 0; call < 32; call++)
			statuses.push((await post(base, link('https://example.com'))).status)

		expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true)
		expect(statuses.slice(30)).toEqual([429, 429])
	})
})

describe('relay client', () => {
	test('returns the html the relay fetched', async () => {
		const base = await start(async () => '<html>recipe</html>')

		expect(
			await fetchViaRelay('https://example.com/r', { url: base, token }),
		).toBe('<html>recipe</html>')
	})

	test('gives up quietly when the relay refuses, is down, or has the wrong token', async () => {
		const base = await start(async () => null)
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		expect(
			await fetchViaRelay('https://example.com/r', { url: base, token }),
		).toBeNull()

		expect(
			await fetchViaRelay('https://example.com/r', {
				url: base,
				token: 'c'.repeat(40),
			}),
		).toBeNull()

		expect(
			await fetchViaRelay('https://example.com/r', {
				url: 'http://127.0.0.1:1',
				token,
			}),
		).toBeNull()
		// A relay that is down is worth a line in the server log, not a throw.
		expect(warn).toHaveBeenCalledWith(
			'recipe relay failed:',
			expect.any(String),
		)
		warn.mockRestore()
	})
})
