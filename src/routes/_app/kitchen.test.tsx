import { renderRoute } from '@tests/support/render/route'
import {
	expectIsolatedScreenshot,
	expectPageScreenshot,
	expectPendingScreenshot,
} from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page } from 'vitest/browser'

import type { pantryItems } from '@/db/schema'
import type { PantryItemInput } from '@/lib/pantry/model'

// A pantry item as the page gets it, with what the server works out about
// how fresh it is.
type KnownItem = typeof pantryItems.$inferSelect & {
	spoils: boolean
	staple: boolean
	stale: boolean
	expired: boolean
	daysLeft: number
	boughtDaysAgo: number
}

// Signed out, the server keeps no pantry.
const state = vi.hoisted<{
	items: KnownItem[]
	signedOut?: boolean
	// The pantry never arrives, so the page stays on its skeleton.
	hang?: boolean
	// A level change waits for this before the server has it.
	held?: Promise<void> | undefined
}>(() => ({ items: [] }))

// What was deleted, so undo can put it back.
const gone = vi.hoisted<{ items: KnownItem[] }>(() => ({ items: [] }))

const bought = vi.hoisted(() => {
	const calls: { text: string }[][] = []

	return { calls }
})

vi.mock('@/lib/groceries/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/groceries/server')>()),
	listGroceries: () => Promise.resolve(state.signedOut ? null : []),
	countWaitingGroceries: () => Promise.resolve(0),
	addGroceries: ({ data }: { data: { text: string }[] }) => {
		bought.calls.push(data)

		return Promise.resolve(data)
	},
	renameGrocery: vi.fn(() => Promise.resolve(null)),
	deleteGrocery: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@/lib/pantry/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/pantry/server')>()),
	// Copies, as the server sends, so a change shows up after a reload.
	listPantry: () =>
		state.hang
			? new Promise(() => {})
			: Promise.resolve(
					state.signedOut ? null : state.items.map((entry) => ({ ...entry })),
				),
	createPantryItems: async ({ data }: { data: PantryItemInput[] }) =>
		data.map((input, index) => {
			const item = {
				...input,
				brand: input.brand ?? null,
				spoils: false,
				staple: true,
				stale: false,
				expired: false,
				daysLeft: 365,
				boughtDaysAgo: 0,
				id: `bulk-${state.items.length + index}`,
				userId: 'user-1',
				level: input.level ?? 'plenty',
				quantity: input.quantity ?? null,
				spriteKey: input.spriteKey ?? null,
				createdAt: new Date('2026-10-19T12:00:00Z'),
				confirmedAt: new Date('2026-10-19T12:00:00Z'),
				boughtAt: new Date('2026-10-19T12:00:00Z'),
				frozenAt: null,
			}

			state.items.push(item)

			return item
		}),
	setPantryItemLevel: async ({
		data,
	}: {
		data: { id: string; level: 'plenty' | 'low' | 'out' }
	}) => {
		await state.held

		const item = state.items.find((entry) => entry.id === data.id)

		if (item) Object.assign(item, { level: data.level, quantity: null })

		// Saying it's low is only said: the list is the cook's to fill.
		return item ?? null
	},
	setPantryItemCount: async ({
		data,
	}: {
		data: { id: string; count: number }
	}) => {
		const item = state.items.find((entry) => entry.id === data.id)

		if (item) item.quantity = data.count

		return { item, listed: false }
	},
	restockPantryItem: async ({
		data,
	}: {
		data: { id: string; added?: number }
	}) => {
		const item = state.items.find((entry) => entry.id === data.id)

		if (item)
			Object.assign(item, {
				boughtDaysAgo: 0,
				quantity:
					data.added === undefined ? null : (item.quantity ?? 0) + data.added,
			})

		return item
	},
	keepPantryItem: async ({ data }: { data: { id: string } }) => {
		const item = state.items.find((entry) => entry.id === data.id)

		if (item) Object.assign(item, { expired: false, daysLeft: 2 })

		return item
	},
	restorePantryItem: async ({ data }: { data: KnownItem }) => {
		state.items.push({ ...gone.items.find((entry) => entry.id === data.id)! })

		return data
	},
	deletePantryItem: async ({ data }: { data: { id: string } }) => {
		gone.items.push(...state.items.filter((entry) => entry.id === data.id))
		state.items = state.items.filter((entry) => entry.id !== data.id)

		return { id: data.id }
	},
}))

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

const item = (
	id: string,
	category: PantryItemInput['category'],
): KnownItem => ({
	id,
	userId: 'user-1',
	name: id,
	level: 'plenty',
	quantity: null,
	category,
	spriteKey: null,
	brand: null,
	createdAt: new Date('2026-10-19T12:00:00Z'),
	confirmedAt: new Date('2026-10-19T12:00:00Z'),
	boughtAt: new Date('2026-10-19T12:00:00Z'),
	frozenAt: null,
	spoils: false,
	staple: true,
	stale: false,
	expired: false,
	daysLeft: 1400,
	boughtDaysAgo: 30,
})

describe('pantry and groceries', () => {
	beforeEach(() => {
		state.items = [item('carrots', 'vegetables'), item('eggs', 'dairy')]
		state.signedOut = false
		state.hang = false
		state.held = undefined
		bought.calls.length = 0
	})

	test('asks a signed-out visitor to sign up before keeping a pantry', async () => {
		state.signedOut = true
		const { screen } = await renderRoute({ path: '/pantry' })

		await expect
			.element(
				screen.getByRole('heading', { name: 'keep track of your kitchen' }),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'stock up' }))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'sign in' }).click()
		await expect
			.element(screen.getByRole('dialog', { name: 'sign in' }))
			.toBeVisible()
	})

	test('sends a signed-out visitor from stocking up to the pantry', async () => {
		state.signedOut = true
		const { router } = await renderRoute({ path: '/pantry/bulk' })

		await expect.poll(() => router.state.location.pathname).toBe('/pantry')
	})

	test('lays food out by how long it has, soonest first', async () => {
		state.items = [
			{ ...item('salmon', 'meat'), spoils: true, daysLeft: 3 },
			{ ...item('spinach', 'vegetables'), spoils: true, daysLeft: 1 },
			{ ...item('milk', 'dairy'), spoils: true, daysLeft: 10 },
			{ ...item('eggs', 'dairy'), level: 'out' },
			{ ...item('garlic', 'vegetables'), level: 'low' },
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({ path: '/pantry', session })
		const main = screen.getByRole('main')

		await expect
			.element(main.getByRole('heading', { level: 2 }).first())
			.toBeVisible()
		// Soonest first; what keeps a while is on its shelf, not here.
		expect(
			main
				.getByRole('heading', { level: 2 })
				.elements()
				.map((heading) => heading.textContent),
		).toEqual(['use now', 'this week', 'next week'])
		await expect
			.element(screen.getByRole('link', { name: /^rice/ }))
			.not.toBeInTheDocument()

		const names = (label: string) =>
			screen
				.getByRole('region', { name: label, exact: true })
				.getByRole('link')
				.elements()
				.map((link) => link.getAttribute('aria-label'))

		expect(names('use now')).toEqual(['spinach, enough, tomorrow'])
		expect(names('this week')).toEqual(['salmon, enough, 3 days'])
		expect(names('next week')).toEqual(['milk, enough, 10 days'])
		await expectPageScreenshot(screen.container, 'kitchen-first')

		// What's low or out waits folded up top, out first.
		const short = screen.getByRole('region', { name: 'running low' })

		await short.getByRole('button', { name: /2 running low/ }).click()
		expect(
			short
				.getByRole('link')
				.elements()
				.map((link) => link.getAttribute('aria-label')),
		).toEqual(['eggs, out', 'garlic, running low'])
	})

	test('shelves all your food by kind, each folded until opened', async () => {
		state.items = [
			item('cumin', 'spices'),
			{ ...item('oregano', 'spices'), level: 'low' },
			item('soy sauce', 'sauces'),
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({ path: '/pantry/staples', session })
		const spices = screen.getByRole('region', { name: 'spices', exact: true })

		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'all your food' }))
			.toBeVisible()
		// Folded, a shelf says only what's short on it.
		await expect
			.element(spices.getByRole('button', { name: /^spices/ }))
			.toHaveAttribute('aria-expanded', 'false')
		await expect.element(spices.getByText('1 low')).toBeVisible()
		await expectPageScreenshot(screen.container, 'kitchen-shelves')

		await spices.getByRole('button', { name: /^spices/ }).click()
		await expect
			.element(spices.getByRole('button', { name: 'oregano, running low' }))
			.toBeVisible()
		await spices.getByRole('button', { name: 'cumin, have it' }).click()
		await expect
			.element(page.getByRole('button', { name: 'low', exact: true }))
			.toBeVisible()
	})

	test('says food is low without listing it, then lists it when asked', async () => {
		const { screen } = await renderRoute({
			path: '/pantry?item=carrots',
			session,
		})

		await expect.element(page.getByRole('dialog')).toBeVisible()
		await page.getByRole('button', { name: 'low', exact: true }).click()
		await expect.poll(() => state.items[0]?.level).toBe('low')
		expect(bought.calls).toEqual([])

		await page.getByRole('button', { name: 'add to list' }).click()
		await expect.poll(() => bought.calls).toHaveLength(1)
		expect(bought.calls[0]?.[0]?.text).toContain('carrots')
		await expect
			.element(screen.getByText('added carrots to your list'))
			.toBeVisible()
	})

	test('leaves where you are to the nav, with no title or back link', async () => {
		const { screen } = await renderRoute({ path: '/pantry', session })

		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'pantry' }))
			.toHaveClass('sr-only')
		await expect
			.element(
				screen.getByRole('main').getByRole('link', { name: 'my recipes' }),
			)
			.not.toBeInTheDocument()
		await expect
			.element(
				screen
					.getByRole('navigation', { name: 'Primary' })
					.getByRole('link', { name: 'my recipes' }),
			)
			.toHaveAttribute('href', '/recipes')
	})

	test('invites an empty kitchen to stock up', async () => {
		state.items = []

		const { screen } = await renderRoute({ path: '/pantry', session })

		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await screen
			.getByRole('main')
			.getByRole('link', { name: 'stock up' })
			.last()
			.click()
		await expect
			.element(screen.getByRole('heading', { name: 'all your food' }))
			.toBeVisible()
	})

	test('says when no fresh food is close to its days', async () => {
		const { screen } = await renderRoute({ path: '/pantry', session })

		await expect
			.element(screen.getByText('no fresh food expiring soon'))
			.toBeVisible()
		await screen.getByRole('link', { name: 'see all your food' }).click()
		await expect
			.element(screen.getByRole('heading', { name: 'all your food' }))
			.toBeVisible()
	})

	test('shows a new level at the tap, before the server has it', async () => {
		let answer = () => {}

		state.held = new Promise((resolve) => {
			answer = resolve
		})

		await renderRoute({ path: '/pantry?item=carrots', session })

		await page.getByRole('button', { name: 'out', exact: true }).click()
		await expect
			.element(page.getByRole('button', { name: 'out', exact: true }))
			.toHaveAttribute('aria-pressed', 'true')
		expect(state.items[0]?.level).not.toBe('out')

		answer()
		await expect.poll(() => state.items[0]?.level).toBe('out')
	})

	test('says how much is left, and removes an item', async () => {
		state.items[0] = {
			...item('carrots', 'vegetables'),
			spoils: true,
			daysLeft: 5,
		}

		const { screen } = await renderRoute({ path: '/pantry', session })

		await screen.getByRole('link', { name: /^carrots, enough/ }).click()
		// Opened by its row: what's short, buying more, and its dates.
		await expectIsolatedScreenshot(page.getByRole('dialog'), 'kitchen-details')
		await page.getByRole('button', { name: 'low', exact: true }).click()
		await expect.poll(() => state.items[0]?.level).toBe('low')
		await expect
			.element(page.getByRole('button', { name: 'low', exact: true }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect
			.element(page.getByRole('button', { name: 'one more' }))
			.not.toBeInTheDocument()
		// Removed at once, from the pantry too, and back as it was with undo.
		await page.getByRole('button', { name: 'delete' }).click()
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
		await expect
			.poll(() => state.items.map((entry) => entry.id))
			.toEqual(['eggs'])
		await page.getByRole('button', { name: 'undo' }).click()
		// Back among what's running low, as it was left.
		await expect
			.element(screen.getByRole('button', { name: /1 running low/ }))
			.toBeVisible()
		expect(state.items.find((entry) => entry.id === 'carrots')).toMatchObject({
			level: 'low',
		})
	})

	test('counts eggs, a pack at a time', async () => {
		await renderRoute({ path: '/pantry?item=eggs', session })

		await page.getByRole('button', { name: 'bought 18' }).click()
		await expect.poll(() => state.items[1]?.quantity).toBe(18)
		await page.getByRole('button', { name: 'one fewer' }).click()
		await expect.poll(() => state.items[1]?.quantity).toBe(17)
		await expect
			.element(page.getByRole('status', { name: 'count' }))
			.toHaveTextContent('× 17')
	})

	test('adds a food from its shelf at a tap', async () => {
		const { screen } = await renderRoute({ path: '/pantry/staples', session })
		const spices = screen.getByRole('region', { name: 'spices', exact: true })

		await spices.getByRole('button', { name: /^spices/ }).click()
		await spices.getByRole('button', { name: 'add cumin' }).click()
		// Solid at once, kept once the server has it.
		await expect
			.element(spices.getByRole('button', { name: 'cumin, have it' }))
			.toBeVisible()
		expect(state.items.slice(2)).toEqual([
			expect.objectContaining({ name: 'cumin', category: 'spices' }),
		])
		await expect
			.element(spices.getByRole('button', { name: 'add cumin' }))
			.not.toBeInTheDocument()
	})

	test('adds a typed food the shelves don’t offer, with undo', async () => {
		const { screen } = await renderRoute({ path: '/pantry/staples', session })

		await screen
			.getByRole('searchbox', { name: 'find or add a food' })
			.fill('aleppo pepper')
		await screen.getByRole('button', { name: 'add “aleppo pepper”' }).click()
		await expect
			.poll(() => state.items.map((entry) => entry.name))
			.toContain('aleppo pepper')

		await page.getByRole('button', { name: 'undo' }).click()
		await expect
			.poll(() => state.items.map((entry) => entry.name))
			.not.toContain('aleppo pepper')
	})

	test('finds what is kept or offered instead of adding it twice', async () => {
		const { screen } = await renderRoute({ path: '/pantry/staples', session })
		const find = screen.getByRole('searchbox', { name: 'find or add a food' })

		await find.fill('carrots')
		await expect
			.element(screen.getByRole('button', { name: 'carrots, have it' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: /^add .carrots.$/ }))
			.not.toBeInTheDocument()

		await find.fill('cumin')
		await expect
			.element(screen.getByRole('button', { name: 'add cumin' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'add “cumin”' }))
			.not.toBeInTheDocument()
	})

	test('takes food off its shelf while editing, with undo', async () => {
		const { screen } = await renderRoute({ path: '/pantry/staples', session })
		const fridge = screen.getByRole('region', { name: 'fridge', exact: true })

		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(screen.getByText('tap what you no longer keep'))
			.toBeVisible()
		await fridge.getByRole('button', { name: /^fridge/ }).click()
		// Editing offers nothing new, only what's kept to take off.
		await expect
			.element(fridge.getByRole('button', { name: /^add / }).first())
			.not.toBeInTheDocument()
		await fridge.getByRole('button', { name: 'remove carrots' }).click()
		await expect
			.element(fridge.getByRole('button', { name: 'remove carrots' }))
			.not.toBeInTheDocument()
		await expect
			.poll(() => state.items.map((entry) => entry.id))
			.not.toContain('carrots')

		await page.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(fridge.getByRole('button', { name: 'remove carrots' }))
			.toBeVisible()
	})

	test('takes a food off from its own dialog', async () => {
		const { screen } = await renderRoute({ path: '/pantry/staples', session })
		const fridge = screen.getByRole('region', { name: 'fridge', exact: true })

		await fridge.getByRole('button', { name: /^fridge/ }).click()
		await fridge.getByRole('button', { name: /^carrots, / }).click()
		await page.getByRole('button', { name: 'delete' }).click()
		await expect
			.element(fridge.getByRole('button', { name: /^carrots, / }))
			.not.toBeInTheDocument()
		await expect
			.poll(() => state.items.map((entry) => entry.id))
			.not.toContain('carrots')
	})

	test('keeps what old ingredient links asked for when they redirect', async () => {
		const pantry = await renderRoute({
			path: '/ingredients?spot=fridge&item=pantry-1',
			session,
		})

		await expect
			.poll(() => pantry.router.state.location.search)
			.toMatchObject({ item: 'pantry-1' })
		expect(pantry.router.state.location.pathname).toBe('/pantry')
		await pantry.screen.unmount()

		const bulk = await renderRoute({
			path: '/ingredients/bulk?cat=fruit',
			session,
		})

		// The aisle it named is the shelf it opens on.
		await expect
			.poll(() => bulk.router.state.location.pathname)
			.toBe('/pantry/staples')
		expect(bulk.router.state.location.search).toMatchObject({
			shelf: 'fridge',
		})
	})

	test('sends the old add page to all your food', async () => {
		const { screen } = await renderRoute({ path: '/ingredients/new', session })

		await expect
			.element(screen.getByRole('heading', { name: 'all your food' }))
			.toBeVisible()
	})

	test('asks about food past its days instead of dropping it', async () => {
		state.items = [
			{ ...item('spinach', 'vegetables'), expired: true, boughtDaysAgo: 9 },
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({ path: '/pantry', session })

		const check = screen.getByRole('region', { name: 'still have these?' })

		await expect.element(check.getByText(/^spinach/)).toBeVisible()
		await expectPageScreenshot(screen.container, 'kitchen-check')
		await check.getByRole('button', { name: 'still have it' }).click()
		await expect
			.element(screen.getByRole('region', { name: 'still have these?' }))
			.not.toBeInTheDocument()
	})

	test.each([
		{ to: '/pantry' as const, name: 'kitchen-pending' },
		{ to: '/groceries' as const, name: 'kitchen-groceries-pending' },
	])('draws a slow $name as the page it opens on', async ({ to, name }) => {
		const { screen, router } = await renderRoute({
			path: '/recipes/new',
			session,
		})

		state.hang = true
		void router.navigate({ to })

		await expectPendingScreenshot(screen, name)
	})
})
