// Lab benchmark: how the app feels on a phone. Loads pages cold, then taps
// through the app signed in, on an emulated mid-range phone on 4G, and prints
// the median of each measure.
//
//   vp run bench <base url> [runs]
//
// Signs in as bench@cocochef.test, creating the account the first time;
// locally, `vp run bench:seed` then gives it a shelf to tap through.
// Run it against a production build
// (`vp run build`, then `vp run start`) or a deployed URL, never the dev
// server: dev serves unbundled modules and is many times slower. Lab numbers
// drift between sessions, so compare two builds in one sitting, not against
// numbers from another day.
import { chromium, devices } from '@playwright/test'
import type { BrowserContext, Locator, Page } from '@playwright/test'

const [base = 'http://localhost:3000', runsArg = '5'] = process.argv.slice(2)

const runs = Number(runsArg)

// The account scripts/bench-seed.sql fills.
const email = 'bench@cocochef.test'

const password = 'bench-password-123'

// 4x CPU slowdown, 100ms round trips, ~9 Mbps down: a mid-range phone on 4G.
const phone = { cpu: 4, latency: 100, down: 9, up: 3 }

const median = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

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
async function signIn(browser: Browser) {
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

async function coldLoad(context: BrowserContext, path: string): Promise<Row> {
	const page = await context.newPage()
	await throttle(context, page)
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

		const scripts = performance
			.getEntriesByType('resource')
			.filter((entry) => entry instanceof PerformanceResourceTiming)
			.filter((entry) => entry.name.endsWith('.js'))

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

	await page.close()

	return row
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

// A cook's loop: the shelf, a recipe and back, groceries, the pantry, home,
// then the shelf and the same recipe again (pages already seen).
const tab = (name: string) => (page: Page) =>
	page.getByRole('link', { name, exact: true }).locator('visible=true').first()

const lentilSoup = (page: Page) =>
	page
		.getByRole('link', { name: /lentil soup/ })
		.locator('visible=true')
		.first()

const journey: [string, ((page: Page) => Locator) | 'back', RegExp][] = [
	['→ recipes', tab('recipes'), /\/recipes$/],
	['→ a recipe', lentilSoup, /\/[^/]+\/lentil-soup$/],
	['← back', 'back', /\/recipes$/],
	['→ groceries', tab('groceries'), /\/groceries$/],
	['→ ingredients', tab('ingredients'), /\/ingredients$/],
	['→ home', tab('home'), /\/$/],
	['→ recipes again', tab('recipes'), /\/recipes$/],
	['→ recipe again', lentilSoup, /\/[^/]+\/lentil-soup$/],
]

function print(title: string, rows: Map<string, Row[]>) {
	const keys = Object.keys([...rows.values()][0]?.[0] ?? {})
	console.log(`\n${title}`)
	console.log('  '.padEnd(22) + keys.map((key) => key.padStart(12)).join(''))

	for (const [name, results] of rows) {
		const cells = keys.map((key) =>
			String(Math.round(median(results.map((row) => row[key] ?? 0)))).padStart(
				12,
			),
		)

		console.log(`  ${name.padEnd(20)}${cells.join('')}`)
	}
}

const browser = await chromium.launch()

const session = await signIn(browser)

const loads = new Map<string, Row[]>()

const taps = new Map<string, Row[]>()

console.log(
	`${base}: ${runs} runs, cpu ${phone.cpu}x, ${phone.latency}ms rtt, ${phone.down} Mbps (medians, ms and KB)`,
)

for (let run = 0; run < runs; run++) {
	for (const path of ['/', '/recipes', '/recipes/bench-recipe-1']) {
		const context = await phoneContext(browser, session)
		loads.set(path, [...(loads.get(path) ?? []), await coldLoad(context, path)])
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
			const row = await tap(page, target, path)
			taps.set(name, [...(taps.get(name) ?? []), row])
		} catch (cause) {
			throw new Error(`${name} stopped at ${page.url()}`, { cause })
		}
	}

	await context.close()
}

await browser.close()

print('cold loads', loads)

print('taps', taps)
