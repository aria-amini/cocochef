import { renderRoute } from '@tests/support/render/route'
import { expectPageScreenshot } from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

import type { pantryItems } from '@/db/schema'
import type { PantryItemInput } from '@/lib/pantry/model'

// A pantry item as the page gets it, with what the server works out about
// how fresh it is.
type KnownItem = typeof pantryItems.$inferSelect & {
	spoils?: boolean
	daysLeft?: number | null
	boughtDaysAgo?: number
}

const state = vi.hoisted<{ items: KnownItem[] }>(() => ({ items: [] }))

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
	listPantry: async () => state.items.map((entry) => ({ ...entry })),
	createPantryItems: async ({ data }: { data: PantryItemInput[] }) =>
		data.map((input, index) => {
			const item = {
				...input,
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
	deletePantryItem: async ({ data }: { data: { id: string } }) => {
		state.items = state.items.filter((entry) => entry.id !== data.id)

		return { id: data.id }
	},
}))

// Every category open, as a cook who has opened them all would see it.
const open = { 'cocochef:folded-categories': '' }

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
})

describe('ingredients', () => {
	beforeEach(() => {
		state.items = [item('carrots', 'vegetables'), item('eggs', 'dairy')]
		bought.calls.length = 0
	})

	test('groups by stock, what is gone first, a tap from the list', async () => {
		state.items = [
			{ ...item('carrots', 'vegetables'), level: 'low' },
			{ ...item('garlic', 'vegetables'), level: 'low' },
			{ ...item('eggs', 'dairy'), level: 'out' },
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'amount left' }).click()

		const out = screen.getByRole('group', { name: 'out' })
		const low = screen.getByRole('group', { name: 'running low' })

		await expect
			.element(out.getByRole('link', { name: 'eggs, out' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'rice, have it' }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'ingredients-by-stock')
		await low.getByRole('button', { name: 'add 2 to groceries' }).click()
		await expect
			.poll(() => bought.calls)
			.toEqual([[{ text: 'carrots' }, { text: 'garlic' }]])
	})

	test('offers a low item to the groceries from its details', async () => {
		state.items = [{ ...item('carrots', 'vegetables'), level: 'low' }]

		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'carrots, running low' }).click()
		await page
			.getByRole('complementary', { name: 'Item details' })
			.or(page.getByRole('dialog'))
			.getByRole('button', { name: 'add to groceries' })
			.click()
		await expect.poll(() => bought.calls).toEqual([[{ text: 'carrots' }]])
	})

	test('groups everything by category and toggles a filter', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
		})

		const carrots = screen.getByRole('link', { name: 'carrots, have it' })
		const eggs = screen.getByRole('link', { name: 'eggs, have it' })
		await expect.element(carrots).toBeVisible()
		await expect.element(eggs).toBeVisible()
		await expect
			.element(screen.getByRole('heading', { name: /vegetables & herbs/ }))
			.toBeVisible()

		await expectPageScreenshot(screen.container, 'ingredients-list')

		// "Do I have it?": a search shows only what matches.
		const find = screen.getByRole('searchbox', { name: 'find an ingredient' })

		await find.fill('eg')
		await expect.element(carrots).not.toBeInTheDocument()
		await expect.element(eggs).toBeVisible()
		await find.fill('saffron')
		await expect
			.element(screen.getByText('no saffron in your ingredients'))
			.toBeVisible()
		await find.fill('')
		await expect.element(carrots).toBeVisible()
	})

	test('leaves where you are to the nav, with no title or back link', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
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
			localStorage: open,
		})

		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'add ingredients' }))
			.not.toBeInTheDocument()
		await screen.getByRole('link', { name: 'stock up' }).click()
		await expect
			.element(screen.getByRole('heading', { name: 'stock up fast' }))
			.toBeVisible()
	})

	test('says how much is left, and removes an item', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'carrots, have it' }).click()
		await page.getByRole('button', { name: 'running low' }).click()
		await expect.poll(() => state.items[0]?.level).toBe('low')
		await expect
			.element(page.getByRole('button', { name: 'running low' }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect
			.element(page.getByRole('button', { name: 'one more' }))
			.not.toBeInTheDocument()
		await page.getByRole('button', { name: 'remove from ingredients' }).click()
		await expect
			.poll(() => state.items.map((entry) => entry.id))
			.toEqual(['eggs'])
	})

	test('counts eggs, a pack at a time', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'eggs, have it' }).click()
		await page.getByRole('button', { name: 'add a pack of 18' }).click()
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
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'add ingredients' }).click()
		await screen.getByRole('link', { name: /spices/ }).click()

		await screen.getByRole('button', { name: 'cumin', exact: true }).click()
		const filter = screen.getByRole('searchbox', { name: 'filter' })
		await filter.fill('smoked pap')
		await userEvent.keyboard('{Enter}')
		await filter.fill('aleppo pepper')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('button', { name: 'aleppo pepper' }))
			.toHaveAttribute('aria-pressed', 'true')

		await screen.getByRole('button', { name: 'add 3' }).click()
		await expect
			.element(screen.getByRole('link', { name: /spices/ }))
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
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'add ingredients' }).click()
		await screen.getByRole('link', { name: /spices/ }).click()

		await screen.getByRole('searchbox', { name: 'filter' }).fill('carrots')
		await userEvent.keyboard('{Enter}')

		await expect
			.element(screen.getByRole('button', { name: 'add 0' }))
			.toBeDisabled()
		await expect
			.element(screen.getByRole('button', { name: /add .carrots./ }))
			.not.toBeInTheDocument()
	})

	test('redirects the old add page to the section picker', async () => {
		const { screen } = await renderRoute({ path: '/ingredients/new', session })
		await screen.getByRole('link', { name: /dairy & eggs/ }).click()
		await expect
			.element(screen.getByRole('button', { name: /^eggs\W+already stashed$/ }))
			.toBeDisabled()
	})

	test('opens bulk add straight into a category from its group', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: open,
		})

		await screen.getByRole('link', { name: 'Add vegetables & herbs' }).click()
		await expect
			.element(screen.getByRole('button', { name: /carrots/ }))
			.toBeDisabled()
	})

	test('lists a stocked kitchen compactly, noting only what matters', async () => {
		state.items = [
			item('carrots', 'vegetables'),
			{ ...item('garlic', 'vegetables'), level: 'low' },
			item('onions', 'vegetables'),
			{ ...item('eggs', 'dairy'), quantity: 9 },
			item('butter', 'dairy'),
			{ ...item('milk', 'dairy'), level: 'out' },
			item('cumin', 'spices'),
			item('paprika', 'spices'),
			item('rice', 'grains'),
		]

		const { screen } = await renderRoute({
			path: '/ingredients',
			session,
			localStorage: {},
		})

		// Every category starts folded, saying how many and how many are low.
		await expect
			.element(screen.getByRole('heading', { name: 'dairy & eggs' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'cumin, have it' }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'ingredients-folded')
		await screen.getByRole('heading', { name: 'dairy & eggs' }).click()
		await expect
			.element(screen.getByRole('link', { name: 'eggs, 9 left' }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'ingredients-stocked')

		// Opened, it stays open next time.
		await screen.getByRole('heading', { name: 'spices' }).click()
		await expect
			.element(screen.getByRole('link', { name: 'cumin, have it' }))
			.toBeVisible()
		expect(localStorage.getItem('cocochef:folded-categories')).toBe(
			'meat,vegetables,fruit,grains,cans,sauces,frozen,other',
		)

		// A search opens a folded group to show what matches.
		await screen
			.getByRole('searchbox', { name: 'find an ingredient' })
			.fill('rice')
		await expect
			.element(screen.getByRole('link', { name: 'rice, have it' }))
			.toBeVisible()
	})

	test('groups by freshness, what spoils soonest first', async () => {
		state.items = [
			{
				...item('salmon', 'meat'),
				spoils: true,
				daysLeft: 2,
				boughtDaysAgo: 2,
			},
			{
				...item('avocados', 'vegetables'),
				spoils: true,
				daysLeft: 0,
				boughtDaysAgo: 4,
			},
			{
				...item('lemons', 'fruit'),
				spoils: true,
				daysLeft: 20,
				boughtDaysAgo: 1,
			},
			{ ...item('rice', 'grains'), spoils: false, daysLeft: 1400 },
		]

		const { screen } = await renderRoute({
			path: '/ingredients?by=freshness',
			session,
		})

		const soon = screen.getByRole('group', { name: 'use soon' })

		await expect
			.element(soon.getByRole('link', { name: /^avocados/ }))
			.toBeVisible()
		await expect
			.element(
				screen
					.getByRole('group', { name: 'in a few weeks' })
					.getByRole('link', { name: 'lemons, have it' }),
			)
			.toBeVisible()
		await expect.element(screen.getByText('bought yesterday')).toBeVisible()

		// Soonest first.
		const top = (name: RegExp) =>
			soon.getByRole('link', { name }).element().getBoundingClientRect().top

		expect(top(/^avocados/)).toBeLessThan(top(/^salmon/))
		// What never really spoils starts folded here.
		await expect
			.element(screen.getByRole('link', { name: 'rice, have it' }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'ingredients-by-freshness')
	})

	test('breaks a long freshness section quietly by category', async () => {
		const keeps = (name: string, category: PantryItemInput['category']) => ({
			...item(name, category),
			spoils: false,
			daysLeft: 700,
		})

		state.items = [
			keeps('soy sauce', 'sauces'),
			keeps('cumin', 'spices'),
			keeps('rice', 'grains'),
			keeps('paprika', 'spices'),
			keeps('olive oil', 'sauces'),
		]

		const { screen } = await renderRoute({
			path: '/ingredients?by=freshness',
			session,
			localStorage: { 'cocochef:folded-freshness': '' },
		})

		const lasting = screen.getByRole('group', { name: 'non-perishable' })

		await expect
			.element(lasting.getByRole('link', { name: 'cumin, have it' }))
			.toBeVisible()

		const names = lasting
			.getByRole('link')
			.elements()
			.map((link) => link.getAttribute('aria-label')?.split(',')[0])

		expect(names).toEqual([
			'cumin',
			'paprika',
			'rice',
			'olive oil',
			'soy sauce',
		])
		await expectPageScreenshot(screen.container, 'ingredients-freshness-labels')
	})
})
