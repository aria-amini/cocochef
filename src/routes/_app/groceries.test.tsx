import { renderRoute } from '@tests/support/render/route'
import { expectPageScreenshot } from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import { ingredientCategory } from '@/lib/recipes/ingredient-groups'

type Item = {
	id: string
	userId: string
	text: string
	category: ReturnType<typeof ingredientCategory>
	recipeId: string | null
	recipeTitle: string | null
	checkedAt: Date | null
	createdAt: Date
}

const list = vi.hoisted(() => {
	const items: Item[] = []

	return { items }
})

const make = (text: string, extra: Partial<Item> = {}): Item => ({
	id: crypto.randomUUID(),
	userId: 'user-1',
	text,
	category: ingredientCategory(text),
	recipeId: null,
	recipeTitle: null,
	checkedAt: null,
	createdAt: new Date(),
	...extra,
})

vi.mock('@/lib/groceries/server', () => ({
	listGroceries: () => Promise.resolve(list.items),
	countWaitingGroceries: () =>
		Promise.resolve(list.items.filter((item) => !item.checkedAt).length),
	addGroceries: ({ data }: { data: { text: string }[] }) => {
		const added = data.map((row) => make(row.text))
		list.items = [...list.items, ...added]

		return Promise.resolve(added)
	},
	setGroceryChecked: ({ data }: { data: { id: string; checked: boolean } }) => {
		list.items = list.items.map((item) =>
			item.id === data.id
				? { ...item, checkedAt: data.checked ? new Date() : null }
				: item,
		)

		return Promise.resolve(null)
	},
	renameGrocery: ({ data }: { data: { id: string; text: string } }) => {
		list.items = list.items.map((item) =>
			item.id === data.id
				? { ...item, text: data.text, category: ingredientCategory(data.text) }
				: item,
		)

		return Promise.resolve(null)
	},
	deleteGrocery: ({ data }: { data: { id: string } }) => {
		list.items = list.items.filter((item) => item.id !== data.id)

		return Promise.resolve()
	},
	clearCheckedGroceries: () => {
		list.items = list.items.filter((item) => !item.checkedAt)

		return Promise.resolve()
	},
}))

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

describe('groceries', () => {
	beforeEach(() => {
		list.items = []
	})

	test('says how to fill an empty list', async () => {
		const { screen } = await renderRoute({ path: '/groceries', session })

		await expect
			.element(screen.getByRole('heading', { name: 'groceries', level: 1 }))
			.toBeVisible()
		await expect.element(screen.getByText('nothing to buy')).toBeVisible()
		await expect
			.element(screen.getByRole('main').getByRole('link', { name: 'recipe' }))
			.toHaveAttribute('href', '/recipes')
	})

	test('shelves the list by aisle and moves bought items to the cart', async () => {
		list.items = [
			make('2 cloves garlic', {
				recipeId: 'recipe-1',
				recipeTitle: 'miso butter pasta',
			}),
			make('2 tbsp butter', {
				recipeId: 'recipe-1',
				recipeTitle: 'miso butter pasta',
			}),
			make('1 onion'),
		]

		const { screen } = await renderRoute({ path: '/groceries', session })

		const vegetables = screen.getByRole('region', {
			name: 'vegetables & herbs',
		})

		await expect
			.element(vegetables.getByRole('checkbox', { name: '1 onion' }))
			.toBeVisible()
		await expect
			.element(
				screen
					.getByRole('region', { name: 'dairy & eggs' })
					.getByRole('link', { name: 'miso butter pasta' }),
			)
			.toHaveAttribute('href', '/recipes/recipe-1')

		// Typed items go in one after another and find their own aisle.
		await screen.getByRole('textbox', { name: 'add an item' }).fill('paprika')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('textbox', { name: 'add an item' }))
			.toHaveValue('')
		await expect
			.element(
				screen
					.getByRole('region', { name: 'spices' })
					.getByRole('checkbox', { name: 'paprika' }),
			)
			.toBeVisible()
		await expect.element(screen.getByText('4 to buy')).toBeVisible()
		await expectPageScreenshot(screen.container, 'groceries')

		await screen.getByRole('checkbox', { name: '1 onion' }).click()
		await expect
			.element(
				screen
					.getByRole('region', { name: 'in the cart' })
					.getByRole('checkbox', { name: '1 onion' }),
			)
			.toBeChecked()
		await expect.element(screen.getByText('3 to buy')).toBeVisible()

		await screen.getByRole('button', { name: 'clear' }).click()
		await expect
			.element(screen.getByRole('region', { name: 'in the cart' }))
			.not.toBeInTheDocument()
		expect(list.items.map((item) => item.text)).toEqual([
			'2 cloves garlic',
			'2 tbsp butter',
			'paprika',
		])
	})

	test('renames and removes an item', async () => {
		list.items = [make('1 onion')]

		const { screen } = await renderRoute({ path: '/groceries', session })

		await screen
			.getByRole('textbox', { name: 'rename 1 onion' })
			.fill('2 onions')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('checkbox', { name: '2 onions' }))
			.toBeVisible()

		await screen.getByRole('button', { name: 'remove 2 onions' }).click()
		await expect.element(screen.getByText('nothing to buy')).toBeVisible()
		expect(list.items).toEqual([])
	})
})
