// Lab benchmark: how the app feels on a phone. Loads pages cold, then taps
// through the app signed in, on an emulated mid-range phone on 4G, and prints
// the median of each measure.
//
//   vp run bench <url> [runs]
//   vp run bench <before url> <after url> [runs]
//
// Given two builds, it takes turns between them, run by run, so a slow
// stretch of the machine falls on both, and prints both with the change.
//
// Signs in as bench@cocochef.test, creating the account the first time;
// locally, `vp run bench:seed` then gives it a shelf to tap through.
// Run it against a production build
// (`vp run build`, then `vp run start`) or a deployed URL, never the dev
// server: dev serves unbundled modules and is many times slower. Lab numbers
// drift between sessions, so compare two builds in one sitting, not against
// numbers from another day.
//
// To compare a change with its base: build each, one at a time (the base in a
// scratch `git worktree add --detach`, with `.env.workspace.local` copied in
// and `vp i` run). Start each on its own port with BASE_URL to match, so
// sign-in accepts it (`PORT=3101 BASE_URL=http://localhost:3101 vp run
// start`). Run `vp run bench:seed` before each comparison, since a run clears
// one spare recipe. Afterwards, stop both and remove the scratch worktree.
import { chromium, devices } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'

const args = process.argv.slice(2)

const urls = args.filter((arg) => /^https?:\/\//.test(arg))

const runs = Number(args.find((arg) => /^\d+$/.test(arg)) ?? '5')

if (!urls.length) urls.push('http://localhost:3000')

if (urls.length > 2) throw new Error('give one or two urls')

// The account scripts/bench-seed.sql fills.
const email = 'bench@cocochef.test'

const password = 'bench-password-123'

// 4x CPU slowdown, 100ms round trips, ~9 Mbps down: a mid-range phone on 4G.
const phone = { cpu: 4, latency: 100, down: 9, up: 3 }

declare global {
	interface Window {
		bench: {
			lcp: number
			hydrated: number
			longTasks: [number, number][]
			lastChange: number
		}
	}
}

type Browser = Awaited<ReturnType<typeof chromium.launch>>

type Session = Awaited<ReturnType<BrowserContext['storageState']>>

// Signs in once: sign-in is rate limited, and every run starts a fresh
// context with this session's cookie.
async function signIn(browser: Browser, base: string) {
	const context = await browser.newContext()

	const response = await context.request.post(
		`${base}/api/auth/sign-in/email`,
		{
			data: { email, password },
			headers: { origin: base },
		},
	)

	if (!response.ok()) {
		const created = await context.request.post(
			`${base}/api/auth/sign-up/email`,
			{ data: { email, password, name: 'bench' }, headers: { origin: base } },
		)

		if (!created.ok())
			throw new Error(
				`could not sign in (${response.status()}) or sign up (${created.status()})`,
			)
	}

	const session = await context.storageState()
	await context.close()

	return session
}

async function phoneContext(browser: Browser, session: Session) {
	const context = await browser.newContext({
		...devices['iPhone 13'],
		storageState: session,
	})

	// Keep runs out of error reporting, which goes through Sentry's tunnel.
	await context.route(/\/api\/oven$/, (route) => route.abort())

	await context.addInitScript(() => {
		window.bench = { lcp: 0, hydrated: 0, longTasks: [], lastChange: 0 }

		// Hydrated: React has attached its props to the first link or button,
		// so a tap does something.
		const poll = () => {
			const element = document.querySelector('a[href], button')

			if (
				element &&
				Object.keys(element).some((k) => k.startsWith('__reactProps'))
			)
				window.bench.hydrated = performance.now()
			else requestAnimationFrame(poll)
		}

		requestAnimationFrame(poll)
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) window.bench.lcp = entry.startTime
		}).observe({ type: 'largest-contentful-paint', buffered: true })
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				window.bench.longTasks.push([entry.startTime, entry.duration])
		}).observe({ type: 'longtask', buffered: true })
		// The last time the page's content changed, to tell when a tap settles.
		addEventListener('DOMContentLoaded', () => {
			new MutationObserver(() => {
				window.bench.lastChange = performance.now()
			}).observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
			})
		})
	})

	return context
}

type Cdp = Awaited<ReturnType<BrowserContext['newCDPSession']>>

const cdpSessions = new WeakMap<Page, Cdp>()

async function throttle(context: BrowserContext, page: Page) {
	const cdp = await context.newCDPSession(page)
	cdpSessions.set(page, cdp)
	await cdp.send('Network.enable')
	await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
	await cdp.send('Network.emulateNetworkConditions', {
		offline: false,
		latency: phone.latency,
		downloadThroughput: (phone.down * 1024 * 1024) / 8,
		uploadThroughput: (phone.up * 1024 * 1024) / 8,
	})
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: phone.cpu })
}

type Row = Record<string, number>

async function coldLoad(
	context: BrowserContext,
	base: string,
	path: string,
): Promise<Row> {
	const page = await context.newPage()
	await throttle(context, page)

	// Image bytes as the network carried them. The page's own timing reports
	// zero for another site's image, so a photo hotlinked from a recipe site
	// would count as nothing.
	const imageSizes: Promise<number>[] = []

	page.on('requestfinished', (request) => {
		if (request.resourceType() === 'image')
			imageSizes.push(
				request.sizes().then(
					(sizes) => sizes.responseBodySize,
					() => 0,
				),
			)
	})

	await page.goto(base + path, { waitUntil: 'load', timeout: 60_000 })
	await page.waitForFunction(() => window.bench.hydrated > 0, null, {
		timeout: 30_000,
	})
	await page.waitForTimeout(1500)

	const row = await page.evaluate(() => {
		const nav = performance
			.getEntriesByType('navigation')
			.find((entry) => entry instanceof PerformanceNavigationTiming)

		const fcp =
			performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0

		const resources = performance
			.getEntriesByType('resource')
			.filter((entry) => entry instanceof PerformanceResourceTiming)

		const scripts = resources.filter((entry) => entry.name.endsWith('.js'))

		return {
			ttfb: nav?.responseStart ?? 0,
			fcp,
			lcp: window.bench.lcp,
			hydrated: window.bench.hydrated,
			blocking: window.bench.longTasks
				.filter(([start]) => start >= fcp)
				.reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0),
			jsKB:
				scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0) / 1024,
			jsRawKB:
				scripts.reduce((sum, entry) => sum + entry.decodedBodySize, 0) / 1024,
		}
	})

	const imageBytes = (await Promise.all(imageSizes)).reduce(
		(sum, bytes) => sum + bytes,
		0,
	)

	await page.close()

	return { ...row, imgKB: imageBytes / 1024 }
}

// A finger rests on the glass for about 100ms before it lifts, and the app
// can start loading the page at the touch. Playwright's tap() has no rest,
// so this taps through the protocol. Returns when the finger lifted.
async function fingerTap(page: Page, target: Locator) {
	const cdp = cdpSessions.get(page)

	if (!cdp) throw new Error('the page is not throttled')

	await target.scrollIntoViewIfNeeded()
	const box = await target.boundingBox()

	if (!box) throw new Error('nothing to tap')

	const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [point],
	})
	await page.waitForTimeout(100)
	const lifted = await page.evaluate(() => performance.now())
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchEnd',
		touchPoints: [],
	})

	return lifted
}

// One tap: from the finger lifting to the new page done changing.
async function tap(
	page: Page,
	target: ((page: Page) => Locator) | 'back',
	path: RegExp,
): Promise<Row> {
	let serverCalls = 0

	const count = (request: { url: () => string }) => {
		if (request.url().includes('/_serverFn/')) serverCalls += 1
	}

	page.on('request', count)

	await page.evaluate(() => {
		window.bench.longTasks = []
	})

	const start =
		target === 'back'
			? await page.evaluate(() => {
					history.back()

					return performance.now()
				})
			: await fingerTap(page, target(page))

	await page.waitForURL(path, { waitUntil: 'commit' })
	// Settled: no link is still waiting on its page, no skeleton shows, and
	// nothing has changed for half a second.
	await page.waitForFunction(
		() =>
			!document.querySelector('[data-transitioning]') &&
			!document.querySelector('output .sr-only') &&
			performance.now() - window.bench.lastChange > 500,
		null,
		{ timeout: 30_000, polling: 50 },
	)
	page.off('request', count)

	return page.evaluate(
		([began, calls]) => ({
			settled: Math.max(0, window.bench.lastChange - began),
			blocking: window.bench.longTasks.reduce(
				(sum, [, duration]) => sum + Math.max(0, duration - 50),
				0,
			),
			serverCalls: calls,
		}),
		[start, serverCalls] as const,
	)
}

// A cook's loop: the shelf, a recipe and back, the kitchen and its grocery
// list, home, then the shelf and the same recipe again (pages already seen).
const tab = (name: string) => (page: Page) =>
	page.getByRole('link', { name, exact: true }).locator('visible=true').first()

const lentilSoup = (page: Page) =>
	page
		.getByRole('link', { name: /lentil soup/ })
		.locator('visible=true')
		.first()

const groceries = (page: Page) =>
	page
		.getByRole('navigation', { name: 'kitchen' })
		.getByRole('link', { name: /^groceries/ })

const journey: [string, ((page: Page) => Locator) | 'back', RegExp][] = [
	['→ my recipes', tab('my recipes'), /\/recipes$/],
	['→ a recipe', lentilSoup, /\/[^/]+\/lentil-soup$/],
	['← back', 'back', /\/recipes$/],
	['→ kitchen', tab('kitchen'), /\/kitchen$/],
	['→ groceries', groceries, /\/kitchen\?view=groceries$/],
	['→ home', tab('home'), /\/$/],
	['→ my recipes again', tab('my recipes'), /\/recipes$/],
	['→ recipe again', lentilSoup, /\/[^/]+\/lentil-soup$/],
]

// Clearing a recipe off the shelf: from the finger lifting off "delete" in
// the dialog to its tile gone. Each run uses up one of the spare recipes
// scripts/bench-seed.sql makes, so seed again before each sitting.
async function clearOff(page: Page): Promise<Row> {
	await page.goto(new URL('/recipes', page.url()).href, { waitUntil: 'load' })
	await page.waitForFunction(() => window.bench.hydrated > 0)

	const spare = page.getByRole('link', { name: /^spare \d+/ }).first()
	const name = await spare.textContent()

	if (!name) throw new Error('no spare recipes left: run `vp run bench:seed`')

	const title = name.match(/spare \d+/)?.[0] ?? name

	await page.getByRole('button', { name: 'select', exact: true }).click()

	await page.getByRole('button', { name: title, exact: true }).click()
	await page.getByRole('button', { name: 'delete', exact: true }).click()

	const confirm = page
		.getByRole('dialog')
		.getByRole('button', { name: 'delete', exact: true })

	await confirm.waitFor()

	// The shelf's read after the clear: a GET, where the delete is a POST.
	const refreshed = page.waitForResponse(
		(response) =>
			response.url().includes('/_serverFn/') &&
			response.request().method() === 'GET',
		{ timeout: 30_000 },
	)

	const start = await fingerTap(page, confirm)

	// By its name, not its role: the open dialog hides the shelf from roles,
	// and leaving select mode turns the tile back into a link.
	const seen = await page.waitForFunction(
		(name) =>
			[...document.querySelectorAll('main h3')].some(
				(heading) => heading.textContent === name,
			)
				? 0
				: performance.now(),
		title,
		{ timeout: 30_000, polling: 'raf' },
	)

	const gone = await seen.jsonValue()

	// The tile leaves before the server has the change. A sample only counts
	// if the clear went through, and waiting for that is outside the timing.
	const said = page.getByText(/off your shelf|couldn't/)

	await said.first().waitFor({ timeout: 30_000 })

	if (/couldn't/.test((await said.first().textContent()) ?? ''))
		throw new Error(`clearing ${title} off the shelf failed`)

	// The toast comes before the shelf is read again; let that read land
	// before the run moves on.
	await refreshed

	return { gone: Math.max(0, gone - start) }
}

const median = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

type Results = Map<string, Row[]>

// Whether two builds' runs of a measure overlap. With a handful of runs, a
// change counts only when every run of one build beats every run of the
// other; anything less is noise.
function overlap(before: number[], after: number[]) {
	return (
		Math.max(...after) >= Math.min(...before) &&
		Math.max(...before) >= Math.min(...after)
	)
}

// One table per measure group. With two builds, each cell is
// "before → after", and the last column the change in `lead`, marked "~"
// when the builds' runs overlap.
function print(title: string, results: Results[], lead: string) {
	const [first, second] = results
	const names = [...(first?.keys() ?? [])]
	const keys = Object.keys(first?.get(names[0] ?? '')?.[0] ?? {})

	const values = (rows: Results | undefined, name: string, key: string) =>
		(rows?.get(name) ?? []).map((row) => row[key] ?? 0)

	const medians = (rows: Results | undefined, name: string, key: string) =>
		Math.round(median(values(rows, name, key)))

	const width = Math.max(second ? 16 : 10, ...keys.map((key) => key.length + 2))

	console.log(`\n${title}`)
	console.log(
		'  '.padEnd(24) +
			keys.map((key) => key.padStart(width)).join('') +
			(second ? `${lead} change`.padStart(22) : ''),
	)

	for (const name of names) {
		const cells = keys.map((key) => {
			const before = medians(first, name, key)

			return (
				second ? `${before} → ${medians(second, name, key)}` : String(before)
			).padStart(width)
		})

		const before = medians(first, name, lead)
		const after = medians(second, name, lead)
		const change = before ? Math.round(((after - before) / before) * 100) : 0
		const same = overlap(values(first, name, lead), values(second, name, lead))
		const verdict = `${same ? '~' : ''}${change > 0 ? '+' : ''}${change}%`

		console.log(
			`  ${name.padEnd(22)}${cells.join('')}` +
				(second ? verdict.padStart(22) : ''),
		)
	}
}

const browser = await chromium.launch()

const builds = await Promise.all(
	urls.map(async (base) => ({
		base,
		session: await signIn(browser, base),
		loads: new Map<string, Row[]>(),
		taps: new Map<string, Row[]>(),
		actions: new Map<string, Row[]>(),
	})),
)

const add = (results: Results, name: string, row: Row) =>
	results.set(name, [...(results.get(name) ?? []), row])

console.log(
	`${urls.join(' vs ')}: ${runs} runs each, cpu ${phone.cpu}x, ${phone.latency}ms rtt, ${phone.down} Mbps (medians, ms and KB)`,
)

for (let run = 0; run < runs; run++) {
	// Each build goes first on alternate runs.
	const order = run % 2 ? [...builds].reverse() : builds

	for (const { base, session, loads, taps, actions } of order) {
		for (const path of ['/', '/recipes', '/recipes/bench-recipe-1']) {
			const context = await phoneContext(browser, session)
			add(loads, path, await coldLoad(context, base, path))
			await context.close()
		}

		const context = await phoneContext(browser, session)
		const page = await context.newPage()
		await throttle(context, page)
		await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60_000 })
		await page.waitForFunction(() => window.bench.hydrated > 0)
		await page.waitForTimeout(1000)

		for (const [name, target, path] of journey) {
			try {
				add(taps, name, await tap(page, target, path))
			} catch (cause) {
				throw new Error(`${name} stopped at ${page.url()}`, { cause })
			}
		}

		add(actions, 'clear off shelf', await clearOff(page))
		await context.close()
	}
}

await browser.close()

print(
	'cold loads',
	builds.map((build) => build.loads),
	'fcp',
)

print(
	'taps',
	builds.map((build) => build.taps),
	'settled',
)

print(
	'actions',
	builds.map((build) => build.actions),
	'gone',
)
