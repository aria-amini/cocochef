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
}))

vi.mock('@/lib/pantry/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/pantry/server')>()),
	// Copies, as the server sends, so a change shows up after a reload.
	listPantry: async () =>
		state.signedOut ? null : state.items.map((entry) => ({ ...entry })),
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
		const item = state.items.find((entry) => entry.id === data.id)

		if (item) Object.assign(item, { level: data.level, quantity: null })

		// Running low or out goes on the list in the same tap.
		const listed = !!item && data.level !== 'plenty'

		if (listed) bought.calls.push([{ text: item.name }])

		return { item, listed }
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
	createdAt: new Date('2026-10-19T12:00:00Z'),
	confirmedAt: new Date('2026-10-19T12:00:00Z'),
	boughtAt: new Date('2026-10-19T12:00:00Z'),
	frozenAt: null,
	spoils: false,
	stale: false,
	expired: false,
	daysLeft: 1400,
	boughtDaysAgo: 30,
})

describe('kitchen', () => {
	beforeEach(() => {
		state.items = [item('carrots', 'vegetables'), item('eggs', 'dairy')]
		state.signedOut = false
		bought.calls.length = 0
	})

	test('asks a signed-out visitor to sign up before keeping a pantry', async () => {
		state.signedOut = true
		const { screen } = await renderRoute({ path: '/kitchen' })

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

	test('sends a signed-out visitor from stocking up to the kitchen', async () => {
		state.signedOut = true
		const { router } = await renderRoute({ path: '/kitchen/bulk' })

		await expect.poll(() => router.state.location.pathname).toBe('/kitchen')
	})

	test('opens on what to use first, soonest first, with how long each has', async () => {
		state.items = [
			{ ...item('salmon', 'meat'), spoils: true, daysLeft: 2 },
			{ ...item('spinach', 'vegetables'), spoils: true, daysLeft: 1 },
			{ ...item('eggs', 'dairy'), level: 'out' },
			{ ...item('garlic', 'vegetables'), level: 'low' },
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({ path: '/kitchen', session })

		const first = screen.getByRole('list', { name: 'use first' })

		const left = (name: string) =>
			first.getByRole('link', { name }).element().getBoundingClientRect().left

		await expect
			.element(first.getByRole('link', { name: 'spinach, enough, tomorrow' }))
			.toBeVisible()
		expect(left('spinach, enough, tomorrow')).toBeLessThan(
			left('salmon, enough, 2 days'),
		)
		// Food that keeps for weeks, and food that ran out, wait in their spots.
		await expect
			.element(screen.getByRole('link', { name: /^rice/ }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('link', { name: /^eggs/ }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'kitchen-first')
	})

	test('says when nothing needs using first', async () => {
		const { screen } = await renderRoute({ path: '/kitchen', session })

		await expect.element(screen.getByText('nothing to use first')).toBeVisible()
	})

	test('shows what came in last, newest first', async () => {
		state.items = [
			{ ...item('rice', 'grains'), boughtAt: new Date('2026-10-01') },
			{ ...item('milk', 'dairy'), boughtAt: new Date('2026-10-20') },
		]

		const { screen } = await renderRoute({
			path: '/kitchen?list=recent',
			session,
		})

		const recent = screen.getByRole('list', { name: 'recently added' })

		await expect.element(recent).toBeVisible()
		expect(
			recent
				.getByRole('link')
				.elements()
				.map((link) => link.getAttribute('aria-label')?.split(',')[0]),
		).toEqual(['milk', 'rice'])
	})

	test('opens a spot from the picker, as one grid in shelf order', async () => {
		state.items = [
			item('cumin', 'spices'),
			{ ...item('paprika', 'spices'), level: 'out' },
			{ ...item('oregano', 'spices'), level: 'low' },
			item('cinnamon', 'spices'),
			item('rice', 'grains'),
			item('carrots', 'vegetables'),
		]

		const { screen, router } = await renderRoute({
			path: '/kitchen',
			session,
		})

		await screen.getByRole('button', { name: /use first/ }).click()
		await page.getByRole('menuitem', { name: 'pantry' }).click()
		await expect
			.poll(() => router.state.location.search)
			.toEqual({ spot: 'pantry' })

		const pantry = screen.getByRole('list', { name: 'pantry' })

		await expect
			.element(pantry.getByRole('link', { name: 'paprika, out' }))
			.toBeVisible()
		await expect
			.element(pantry.getByRole('link', { name: /^rice/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: /^carrots/ }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'kitchen-spot')

		// A card opens its details.
		await pantry.getByRole('link', { name: /^cumin, enough/ }).click()
		await expect
			.element(page.getByRole('button', { name: 'low', exact: true }))
			.toBeVisible()
	})

	test('says when a spot holds nothing, and offers to stock up', async () => {
		const { screen } = await renderRoute({
			path: '/kitchen?spot=freezer',
			session,
		})

		await expect
			.element(screen.getByText('nothing in the freezer yet'))
			.toBeVisible()
		await expect
			.element(
				screen
					.getByRole('main')
					.getByRole('link', { name: 'stock up' })
					.first(),
			)
			.toHaveAttribute('href', '/kitchen/bulk')
	})

	test('puts food that runs low on the list in the same tap', async () => {
		const { screen } = await renderRoute({
			path: '/kitchen?list=recent',
			session,
		})

		await screen.getByRole('link', { name: /^carrots, enough/ }).click()
		await page.getByRole('button', { name: 'low', exact: true }).click()
		await expect.poll(() => bought.calls).toEqual([[{ text: 'carrots' }]])
		await expect
			.element(page.getByText('carrots is on your list'))
			.toBeVisible()
	})

	test('leaves where you are to the nav, with no title or back link', async () => {
		const { screen } = await renderRoute({ path: '/kitchen', session })

		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'kitchen' }))
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

		const { screen } = await renderRoute({ path: '/kitchen', session })

		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await screen
			.getByRole('main')
			.getByRole('link', { name: 'stock up' })
			.last()
			.click()
		await expect
			.element(screen.getByRole('heading', { name: 'add ingredients' }))
			.toBeVisible()
	})

	test('says how much is left, and removes an item', async () => {
		const { screen } = await renderRoute({
			path: '/kitchen?list=recent',
			session,
		})

		await screen.getByRole('link', { name: /^carrots, enough/ }).click()
		await page.getByRole('button', { name: 'low', exact: true }).click()
		await expect.poll(() => state.items[0]?.level).toBe('low')
		await expect
			.element(page.getByRole('button', { name: 'low', exact: true }))
			.toHaveAttribute('aria-pressed', 'true')
		// How much is left reads as a gauge: bars, tinted for the level.
		await expectIsolatedScreenshot(page.getByRole('dialog'), 'kitchen-details')
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
			path: '/kitchen?list=recent',
			session,
		})

		await screen.getByRole('link', { name: /^eggs, enough/ }).click()
		await page.getByRole('button', { name: 'bought 18' }).click()
		await expect.poll(() => state.items[1]?.quantity).toBe(18)
		await page.getByRole('button', { name: 'one fewer' }).click()
		await expect.poll(() => state.items[1]?.quantity).toBe(17)
		await expect
			.element(page.getByRole('status', { name: 'count' }))
			.toHaveTextContent('× 17')
	})

	test('bulk adds picked and typed items from a section', async () => {
		const { screen } = await renderRoute({ path: '/kitchen', session })

		await screen.getByRole('link', { name: 'stock up' }).first().click()
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
		// Back in the kitchen, to see what was added.
		await expect
			.element(screen.getByRole('region', { name: 'on hand' }))
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
		const { screen } = await renderRoute({ path: '/kitchen', session })

		await screen.getByRole('link', { name: 'stock up' }).first().click()
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

	test('keeps what old ingredient links asked for when they redirect', async () => {
		const pantry = await renderRoute({
			path: '/ingredients?spot=fridge&item=pantry-1',
			session,
		})

		await expect
			.poll(() => pantry.router.state.location.search)
			.toMatchObject({ spot: 'fridge', item: 'pantry-1' })
		expect(pantry.router.state.location.pathname).toBe('/kitchen')
		await pantry.screen.unmount()

		const bulk = await renderRoute({
			path: '/ingredients/bulk?cat=fruit',
			session,
		})

		await expect
			.poll(() => bulk.router.state.location.pathname)
			.toBe('/kitchen/bulk')
		expect(bulk.router.state.location.search).toMatchObject({ cat: 'fruit' })
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

		const { screen } = await renderRoute({ path: '/kitchen', session })

		const check = screen.getByRole('region', { name: /still there/ })

		await expect.element(check.getByText(/^spinach/)).toBeVisible()
		await expectPageScreenshot(screen.container, 'kitchen-check')
		await check.getByRole('button', { name: 'still have it' }).click()
		await expect
			.element(screen.getByRole('region', { name: /still there/ }))
			.not.toBeInTheDocument()
	})
})
