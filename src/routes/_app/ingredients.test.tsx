import { renderRoute } from '@tests/support/render/route'
import { isPhone } from '@tests/support/viewport'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

import type { pantryItems } from '@/db/schema'
import type { PantryItemInput } from '@/lib/pantry/model'

const state = vi.hoisted<{ items: (typeof pantryItems.$inferSelect)[] }>(
	() => ({
		items: [],
	}),
)

vi.mock('@/lib/pantry/server', () => ({
	listPantry: async () => state.items,
	createPantryItems: async ({ data }: { data: PantryItemInput[] }) =>
		data.map((input, index) => {
			const item = {
				...input,
				id: `bulk-${index}`,
				userId: 'user-1',
				spriteKey: input.spriteKey ?? null,
				createdAt: new Date('2026-10-19T12:00:00Z'),
			}

			state.items.push(item)

			return item
		}),
	setPantryItemQuantity: async ({
		data,
	}: {
		data: { id: string; quantity: number }
	}) => {
		const item = state.items.find((entry) => entry.id === data.id)

		if (item) item.quantity = data.quantity

		return item
	},
	deletePantryItem: async ({ data }: { data: { id: string } }) => {
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
): typeof pantryItems.$inferSelect => ({
	id,
	userId: 'user-1',
	name: id,
	quantity: 2,
	category,
	spriteKey: null,
	createdAt: new Date('2026-10-19T12:00:00Z'),
})

describe('ingredients', () => {
	beforeEach(() => {
		state.items = [item('carrots', 'vegetables'), item('eggs', 'dairy')]
	})

	test('groups everything by category and toggles a filter', async () => {
		const { screen } = await renderRoute({ path: '/ingredients', session })
		const carrots = screen.getByRole('link', { name: 'carrots, quantity 2' })
		const eggs = screen.getByRole('link', { name: 'eggs, quantity 2' })
		await expect.element(carrots).toBeVisible()
		await expect.element(eggs).toBeVisible()
		await expect
			.element(screen.getByRole('heading', { name: /vegetables & herbs/ }))
			.toBeVisible()

		const dairy = screen.getByRole('link', {
			name: 'dairy & eggs',
			exact: true,
		})

		await dairy.click()
		await expect.element(carrots).not.toBeInTheDocument()
		await expect.element(eggs).toBeVisible()
		await dairy.click()
		await expect.element(carrots).toBeVisible()
	})

	test('links back to recipes from the page on desktop, the tab bar on phones', async () => {
		const { screen } = await renderRoute({ path: '/ingredients', session })
		const link = screen.getByRole('main').getByRole('link', { name: 'recipes' })

		if (isPhone()) {
			await expect.element(link).not.toBeInTheDocument()
			await expect
				.element(
					screen
						.getByRole('navigation', { name: 'Primary' })
						.getByRole('link', { name: 'recipes' }),
				)
				.toHaveAttribute('href', '/recipes')
		} else {
			await expect.element(link).toHaveAttribute('href', '/recipes')
		}
	})

	test('invites an empty kitchen to add ingredients', async () => {
		state.items = []
		const { screen } = await renderRoute({ path: '/ingredients', session })
		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'add', exact: true }))
			.not.toBeInTheDocument()
		await screen.getByRole('link', { name: 'stock up' }).click()
		await expect
			.element(screen.getByRole('heading', { name: 'stock up fast' }))
			.toBeVisible()
	})

	test('updates and removes the selected item on desktop and mobile', async () => {
		const { screen } = await renderRoute({ path: '/ingredients', session })
		await screen.getByRole('link', { name: 'carrots, quantity 2' }).click()
		await page.getByRole('button', { name: 'Increase quantity' }).click()
		await expect.poll(() => state.items[0]?.quantity).toBe(3)
		await page.getByRole('button', { name: 'use it up — remove it' }).click()
		await expect
			.poll(() => state.items.map((entry) => entry.id))
			.toEqual(['eggs'])
	})

	test('bulk adds picked and typed items from a section', async () => {
		const { screen } = await renderRoute({ path: '/ingredients', session })
		await screen.getByRole('link', { name: 'add', exact: true }).click()
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
		const { screen } = await renderRoute({ path: '/ingredients', session })
		await screen.getByRole('link', { name: 'add', exact: true }).click()
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
		const { screen } = await renderRoute({ path: '/ingredients', session })
		await screen.getByRole('link', { name: 'Add vegetables & herbs' }).click()
		await expect
			.element(screen.getByRole('button', { name: /carrots/ }))
			.toBeDisabled()
	})
})
