import { renderRoute } from '@tests/support/render/route'
import {
	expectIsolatedScreenshot,
	expectPageScreenshot,
} from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

import type { pantryItems } from '@/db/schema'
import type { PantryItemInput } from '@/lib/pantry/model'

// A pantry item as the page gets it, with what the server works out about
// how fresh it is.
type KnownItem = typeof pantryItems.$inferSelect & {
	spoils: boolean
	stale: boolean
	expired: boolean
	daysLeft: number
	boughtDaysAgo: number
}

// Signed out, the server keeps no pantry.
const state = vi.hoisted<{
	items: KnownItem[]
	signedOut?: boolean
	// The shelf recipe that would use up what is going off.
	usingUp?: { id: string; title: string; uses: string[] } | null
}>(() => ({ items: [] }))

// What was deleted, so undo can put it back.
const gone = vi.hoisted<{ items: KnownItem[] }>(() => ({ items: [] }))

const bought = vi.hoisted(() => {
	const calls: { text: string }[][] = []

	return { calls }
})

vi.mock('@/lib/groceries/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/groceries/server')>()),
	countWaitingGroceries: () => Promise.resolve(0),
	addGroceries: ({ data }: { data: { text: string }[] }) => {
		bought.calls.push(data)

		return Promise.resolve(data)
	},
}))

vi.mock('@/lib/pantry/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/pantry/server')>()),
	// Copies, as the server sends, so a change shows up after a reload.
	listPantry: async () =>
		state.signedOut ? null : state.items.map((entry) => ({ ...entry })),
	recipeUsingUp: async () => state.usingUp ?? null,
	createPantryItems: async ({ data }: { data: PantryItemInput[] }) =>
		data.map((input, index) => {
			const item = {
				...input,
				spoils: false,
				stale: false,
				expired: false,
				daysLeft: 365,
				boughtDaysAgo: 0,
				id: `bulk-${index}`,
				userId: 'user-1',
				level: input.level ?? 'plenty',
				quantity: input.quantity ?? null,
				spriteKey: input.spriteKey ?? null,
				createdAt: new Date('2026-10-19T12:00:00Z'),
				confirmedAt: new Date('2026-10-19T12:00:00Z'),
				boughtAt: new Date('2026-10-19T12:00:00Z'),
			}

			state.items.push(item)

			return item
		}),
	setPantryItemLevel: async ({
		data,
	}: {
		data: { id: string; level: 'plenty' | 'low' | 'out' }
	}) => {
		const item = state.items.find((entry) => entry.id === data.id)

		if (item) Object.assign(item, { level: data.level, quantity: null })

		return item
	},
	setPantryItemCount: async ({
		data,
	}: {
		data: { id: string; count: number }
	}) => {
		const item = state.items.find((entry) => entry.id === data.id)

		if (item) item.quantity = data.count

		return item
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
	createdAt: new Date('2026-10-19T12:00:00Z'),
	confirmedAt: new Date('2026-10-19T12:00:00Z'),
	boughtAt: new Date('2026-10-19T12:00:00Z'),
	spoils: false,
	stale: false,
	expired: false,
	daysLeft: 1400,
	boughtDaysAgo: 30,
})

describe('ingredients', () => {
	beforeEach(() => {
		state.items = [item('carrots', 'vegetables'), item('eggs', 'dairy')]
		state.signedOut = false
		state.usingUp = null
		bought.calls.length = 0
	})

	test('asks a signed-out visitor to sign up before keeping a pantry', async () => {
		state.signedOut = true
		const { screen } = await renderRoute({ path: '/ingredients' })

		await expect
			.element(
				screen.getByRole('heading', { name: 'keep track of your kitchen' }),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'add ingredients' }))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'sign in' }).click()
		await expect
			.element(screen.getByRole('dialog', { name: 'sign in' }))
			.toBeVisible()
	})

	test('sends a signed-out visitor from adding ingredients to the pantry page', async () => {
		state.signedOut = true
		const { router } = await renderRoute({ path: '/ingredients/bulk' })

		await expect.poll(() => router.state.location.pathname).toBe('/ingredients')
	})

	test('offers a low item to the groceries from its details', async () => {
		state.items = [{ ...item('carrots', 'vegetables'), level: 'low' }]

		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await screen.getByRole('link', { name: 'carrots, running low' }).click()
		await page
			.getByRole('complementary', { name: 'Item details' })
			.or(page.getByRole('dialog'))
			.getByRole('button', { name: 'add to groceries' })
			.click()
		await expect.poll(() => bought.calls).toEqual([[{ text: 'carrots' }]])
	})

	test('leads with only what asks for something', async () => {
		state.items = [
			{ ...item('salmon', 'meat'), spoils: true, daysLeft: 2 },
			{ ...item('spinach', 'vegetables'), spoils: true, daysLeft: 1 },
			{ ...item('eggs', 'dairy'), level: 'out' },
			{ ...item('garlic', 'vegetables'), level: 'low' },
			item('rice', 'grains'),
			item('cumin', 'spices'),
			item('paprika', 'spices'),
		]
		state.usingUp = {
			id: 'recipe-1',
			title: 'salmon with greens',
			uses: ['spinach', 'salmon'],
		}

		const { screen } = await renderRoute({ path: '/ingredients', session })

		// What is going off, soonest first, and a shelf recipe that uses it.
		const soon = screen.getByRole('region', { name: 'use soon' })

		const left = (name: string) =>
			soon.getByRole('link', { name }).element().getBoundingClientRect().left

		await expect
			.element(soon.getByRole('link', { name: 'spinach, tomorrow' }))
			.toBeVisible()
		expect(left('spinach, tomorrow')).toBeLessThan(left('salmon, 2 days'))
		await expect
			.element(soon.getByRole('link', { name: /cook with them/ }))
			.toHaveAttribute('href', '/recipes/recipe-1')

		// What ran out, then what runs low; the rest is on hand, by spot.
		await expect
			.element(screen.getByRole('link', { name: 'eggs, out' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'rice, enough' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('link', { name: 'spice rack, 2' }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'ingredients-home')

		// One tap puts everything out and low on the list.
		await screen.getByRole('button', { name: 'add 2 to groceries' }).click()
		await expect
			.poll(() => bought.calls)
			.toEqual([[{ text: 'eggs' }, { text: 'garlic' }]])
	})

	test('opens a spot as a wall of jars', async () => {
		state.items = [
			item('cumin', 'spices'),
			{ ...item('paprika', 'spices'), level: 'out' },
			{ ...item('oregano', 'spices'), level: 'low' },
			item('cinnamon', 'spices'),
			item('rice', 'grains'),
		]

		const { screen, router } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await screen.getByRole('link', { name: 'spice rack, 4' }).click()

		const rack = screen.getByRole('region', { name: 'spice rack' })

		await expect
			.element(rack.getByRole('link', { name: 'paprika, out' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'rice, enough' }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'ingredients-spot')

		// A jar opens its details; back goes home.
		await rack.getByRole('link', { name: 'cumin, enough' }).click()
		await expect
			.element(page.getByRole('button', { name: 'low', exact: true }))
			.toBeVisible()
		await page.getByRole('button', { name: 'done' }).click()
		await screen
			.getByRole('main')
			.getByRole('link', { name: 'ingredients', exact: true })
			.click()
		await expect.poll(() => router.state.location.search).toEqual({})
	})

	test('finds an ingredient by name, and says when it is not there', async () => {
		const { screen } = await renderRoute({ path: '/ingredients', session })

		const find = screen.getByRole('searchbox', { name: 'find an ingredient' })

		await find.fill('eg')
		await expect
			.element(screen.getByRole('link', { name: 'eggs, enough' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'carrots, enough' }))
			.not.toBeInTheDocument()
		await find.fill('saffron')
		await expect
			.element(screen.getByText('no saffron in your ingredients'))
			.toBeVisible()
		await find.fill('')
		await expect
			.element(screen.getByRole('region', { name: 'on hand' }))
			.toBeVisible()
	})

	test('leaves where you are to the nav, with no title or back link', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'ingredients' }))
			.toHaveClass('sr-only')
		await expect
			.element(screen.getByRole('main').getByRole('link', { name: 'recipes' }))
			.not.toBeInTheDocument()
		await expect
			.element(
				screen
					.getByRole('navigation', { name: 'Primary' })
					.getByRole('link', { name: 'recipes' }),
			)
			.toHaveAttribute('href', '/recipes')
	})

	test('invites an empty kitchen to add ingredients', async () => {
		state.items = []

		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'add ingredients' }))
			.not.toBeInTheDocument()
		await screen.getByRole('link', { name: 'stock up' }).click()
		await expect
			.element(screen.getByRole('heading', { name: 'add ingredients' }))
			.toBeVisible()
	})

	test('says how much is left, and removes an item', async () => {
		const { screen } = await renderRoute({ path: '/ingredients', session })

		await screen
			.getByRole('searchbox', { name: 'find an ingredient' })
			.fill('carrots')
		await screen.getByRole('link', { name: 'carrots, enough' }).click()
		await page.getByRole('button', { name: 'low', exact: true }).click()
		await expect.poll(() => state.items[0]?.level).toBe('low')
		await expect
			.element(page.getByRole('button', { name: 'low', exact: true }))
			.toHaveAttribute('aria-pressed', 'true')
		// How much is left reads as a gauge: bars, tinted for the level.
		await expectIsolatedScreenshot(
			page.getByRole('dialog'),
			'ingredients-details',
		)
		await expect
			.element(page.getByRole('button', { name: 'one more' }))
			.not.toBeInTheDocument()
		// Removed at once, from the pantry too, and back as it was with undo.
		await page.getByRole('button', { name: 'delete' }).click()
		await expect
			.element(screen.getByRole('link', { name: /^carrots/ }))
			.not.toBeInTheDocument()
		await expect
			.poll(() => state.items.map((entry) => entry.id))
			.toEqual(['eggs'])
		await page.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(screen.getByRole('link', { name: /^carrots/ }))
			.toBeVisible()
		expect(state.items.find((entry) => entry.id === 'carrots')).toMatchObject({
			level: 'low',
		})
	})

	test('counts eggs, a pack at a time', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await screen
			.getByRole('searchbox', { name: 'find an ingredient' })
			.fill('eggs')
		await screen.getByRole('link', { name: 'eggs, enough' }).click()
		await page.getByRole('button', { name: 'bought 18' }).click()
		await expect.poll(() => state.items[1]?.quantity).toBe(18)
		await page.getByRole('button', { name: 'one fewer' }).click()
		await expect.poll(() => state.items[1]?.quantity).toBe(17)
		await expect
			.element(page.getByRole('status', { name: 'count' }))
			.toHaveTextContent('× 17')
	})

	test('bulk adds picked and typed items from a section', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await screen.getByRole('link', { name: 'add ingredients' }).click()
		await screen.getByRole('link', { name: /spices/ }).click()

		await screen.getByRole('button', { name: 'cumin', exact: true }).click()
		const filter = screen.getByRole('searchbox', { name: /^find in/ })
		await filter.fill('smoked pap')
		await userEvent.keyboard('{Enter}')
		await filter.fill('aleppo pepper')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('button', { name: 'aleppo pepper' }))
			.toHaveAttribute('aria-pressed', 'true')

		await screen.getByRole('button', { name: 'add 3' }).click()
		// Back on the pantry, to see what was added.
		await expect
			.element(screen.getByRole('searchbox', { name: 'find an ingredient' }))
			.toBeVisible()
		expect(state.items.slice(2)).toHaveLength(3)
		expect(state.items.slice(2)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'cumin', category: 'spices' }),
				expect.objectContaining({ name: 'smoked paprika' }),
				expect.objectContaining({ name: 'aleppo pepper', category: 'spices' }),
			]),
		)
	})

	test('does not offer to add a typed name the pantry already has', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await screen.getByRole('link', { name: 'add ingredients' }).click()
		await screen.getByRole('link', { name: /spices/ }).click()

		await screen.getByRole('searchbox', { name: /^find in/ }).fill('carrots')
		await userEvent.keyboard('{Enter}')

		await expect
			.element(screen.getByRole('button', { name: 'add', exact: true }))
			.toBeDisabled()
		await expect
			.element(screen.getByRole('button', { name: /add .carrots./ }))
			.not.toBeInTheDocument()
	})

	test('redirects the old add page to the section picker', async () => {
		const { screen } = await renderRoute({ path: '/ingredients/new', session })
		await screen.getByRole('link', { name: /dairy & eggs/ }).click()
		await expect
			.element(screen.getByRole('button', { name: /^eggs\W+already kept$/ }))
			.toBeDisabled()
	})

	test('asks about food past its days instead of dropping it', async () => {
		state.items = [
			{ ...item('spinach', 'vegetables'), expired: true, boughtDaysAgo: 9 },
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		const check = screen.getByRole('region', { name: /still there/ })

		await expect.element(check.getByText(/^spinach/)).toBeVisible()
		await expectPageScreenshot(screen.container, 'ingredients-check')
		await check.getByRole('button', { name: 'still have it' }).click()
		await expect
			.element(screen.getByRole('region', { name: /still there/ }))
			.not.toBeInTheDocument()
	})

	test('offers to add what a search does not find', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await screen
			.getByRole('searchbox', { name: 'find an ingredient' })
			.fill('parsley')
		await expect
			.element(screen.getByText('no parsley in your ingredients'))
			.toBeVisible()
		await screen.getByRole('button', { name: 'i have parsley' }).click()
		await expect
			.poll(() => state.items.map((entry) => entry.name))
			.toContain('parsley')
	})
})
