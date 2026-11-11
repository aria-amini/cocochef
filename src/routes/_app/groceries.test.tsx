import { renderRoute } from '@tests/support/render/route'
import { expectPageScreenshot } from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

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

const restocked = vi.hoisted(() => {
	const calls: { text: string; category: string }[][] = []

	return { calls }
})

vi.mock('@/lib/pantry/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/pantry/server')>()),
	restockPantry: ({ data }: { data: { text: string; category: string }[] }) => {
		restocked.calls.push(data)

		return Promise.resolve({ restocked: 0, added: data.length })
	},
}))

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

// The field over the list on a wide screen; on a phone, the row the round
// plus opens over the keyboard.
async function addField(
	screen: Awaited<ReturnType<typeof renderRoute>>['screen'],
) {
	// An empty list is its own way in; a list with items has the round plus.
	if (window.innerWidth < 768)
		await screen.getByRole('button', { name: /^add (items|an item)$/ }).click()

	return screen.getByRole('combobox', { name: 'add an item' })
}

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

describe('groceries', () => {
	beforeEach(() => {
		list.items = []
		restocked.calls.length = 0
	})

	test('invites an empty list to add, not to go elsewhere', async () => {
		const { screen } = await renderRoute({ path: '/groceries', session })

		await expect
			.element(screen.getByRole('heading', { name: 'groceries', level: 1 }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('heading', { name: 'nothing to buy yet' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('main').getByRole('link', { name: /recipes/ }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'groceries-empty')

		// The plus waits for items: the card is the way in.
		await expect
			.element(screen.getByRole('button', { name: 'add items' }))
			.not.toBeInTheDocument()
		await screen
			.getByRole('region', { name: 'nothing to buy yet' })
			.getByRole('button', { name: 'add an item' })
			.click()
		await expect
			.element(screen.getByRole('combobox', { name: 'add an item' }))
			.toHaveFocus()
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
		// What to buy, not where it came from: no recipe names on the rows.
		expect(screen.getByText('miso butter pasta').elements()).toHaveLength(0)

		await expectPageScreenshot(screen.container, 'groceries')

		// Typed items go in one after another and find their own aisle.
		const field = await addField(screen)
		await field.fill('paprika')
		await userEvent.keyboard('{Enter}')
		await expect.element(field).toHaveValue('')
		await expect
			.element(
				screen
					.getByRole('region', { name: 'spices' })
					.getByRole('checkbox', { name: 'paprika' }),
			)
			.toBeVisible()

		await screen.getByRole('checkbox', { name: '1 onion' }).click()
		await expect
			.element(
				screen
					.getByRole('region', { name: 'in the cart' })
					.getByRole('checkbox', { name: '1 onion' }),
			)
			.toBeChecked()
		// Mid-trip there is no prompt yet, just the cart filling, and the top
		// says how the shop goes and leads to the cart.
		await expect
			.element(screen.getByRole('heading', { name: 'all in the cart' }))
			.not.toBeInTheDocument()
		await expect
			.element(
				screen.getByRole('button', { name: '1 in the cart: go to the cart' }),
			)
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'groceries-shopping')

		await screen.getByRole('button', { name: 'put away' }).click()
		await page
			.getByRole('dialog', { name: 'put away' })
			.getByRole('button', { name: 'put away 1 and clear' })
			.click()
		await expect
			.element(screen.getByRole('region', { name: 'in the cart' }))
			.not.toBeInTheDocument()
		expect(list.items.map((item) => item.text)).toEqual([
			'2 cloves garlic',
			'2 tbsp butter',
			'paprika',
		])
	})

	test('does not add an item already waiting, so a tick lands on it', async () => {
		list.items = [make('milk')]

		const { screen } = await renderRoute({ path: '/groceries', session })

		await (await addField(screen)).fill('Milk')
		await screen.getByRole('button', { name: 'add', exact: true }).click()
		await expect.element(screen.getByText('already on your list')).toBeVisible()
		expect(
			screen.getByRole('checkbox', { name: /^milk$/i }).all(),
		).toHaveLength(1)
		expect(list.items).toHaveLength(1)
	})

	test('ticks an item from anywhere on its row, and names it only in edit', async () => {
		list.items = [make('1 onion')]

		const { screen } = await renderRoute({ path: '/groceries', session })

		// Outside edit the name is read, not typed into.
		await expect
			.element(screen.getByRole('textbox', { name: 'rename 1 onion' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'remove 1 onion' }))
			.not.toBeInTheDocument()

		// A tap on the name ticks it.
		await screen.getByText('1 onion', { exact: true }).click()
		await expect.poll(() => list.items[0]?.checkedAt).toBeInstanceOf(Date)
		await screen.getByText('1 onion', { exact: true }).click()
		await expect.poll(() => list.items[0]?.checkedAt).toBeNull()

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen
			.getByRole('textbox', { name: 'rename 1 onion' })
			.fill('2 onions')
		await userEvent.keyboard('{Enter}')
		await expect.poll(() => list.items[0]?.text).toBe('2 onions')
		await screen.getByRole('button', { name: 'done' }).click()
		await expect
			.element(screen.getByRole('checkbox', { name: '2 onions' }))
			.toBeVisible()
	})

	test('ends the trip once everything is in the cart', async () => {
		list.items = [make('1 onion'), make('soy sauce', { checkedAt: new Date() })]
		const { screen } = await renderRoute({ path: '/groceries', session })

		await screen.getByRole('checkbox', { name: '1 onion' }).click()

		const done = screen.getByRole('region', { name: 'all in the cart' })

		await expect.element(done).toBeVisible()
		await expectPageScreenshot(screen.container, 'groceries-done')
		await done.getByRole('button', { name: 'put away' }).click()
		await expect
			.element(page.getByRole('dialog', { name: 'put away' }))
			.toBeVisible()
	})

	test('puts everything bought away in the pantry, dated today', async () => {
		list.items = [
			make('2 lb short ribs', {
				recipeTitle: 'braised short ribs',
				checkedAt: new Date(),
			}),
			make('1 bag rice', { checkedAt: new Date() }),
			make('soy sauce', { checkedAt: new Date() }),
		]

		const { screen } = await renderRoute({ path: '/groceries', session })

		await screen.getByRole('button', { name: 'put away' }).click()

		const sheet = page.getByRole('dialog', { name: 'put away' })

		const line = (name: string) =>
			sheet.getByRole('checkbox', { name: new RegExp(`^${name}`) })

		await expect.element(line('1 bag rice')).toBeChecked()
		await expect.element(line('soy sauce')).toBeChecked()
		await expect.element(line('2 lb short ribs')).toBeChecked()
		await expect
			.element(sheet.getByText('for braised short ribs'))
			.toBeVisible()

		// Leaving one out keeps it out of the pantry.
		await line('soy sauce').click()
		await expect
			.element(sheet.getByText('2 of 3 into your ingredients'))
			.toBeVisible()

		await sheet.getByRole('button', { name: 'put away 2 and clear' }).click()
		await expect.element(sheet).not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('region', { name: 'in the cart' }))
			.not.toBeInTheDocument()
		expect(restocked.calls).toEqual([
			[
				{ text: '2 lb short ribs', category: 'other' },
				{ text: '1 bag rice', category: 'grains' },
			],
		])
	})

	test('finishes a food from its first letters, and steps its amount', async () => {
		const { screen } = await renderRoute({ path: '/groceries', session })
		const field = await addField(screen)

		await field.fill('garl')
		await screen.getByRole('option', { name: 'garlic' }).click()
		await expect.element(field).toHaveValue('garlic')

		const amount = screen.getByRole('toolbar', { name: 'amount' })

		await amount.getByRole('button', { name: 'more' }).click()
		await expect.element(field).toHaveValue('1 garlic')
		await userEvent.keyboard('{Enter}')
		await expect
			.poll(() => list.items.map((item) => item.text))
			.toEqual(['1 garlic'])
	})

	test('keeps the phone row open for the next item, and says where each went', async () => {
		if (window.innerWidth >= 768) return
		const { screen } = await renderRoute({ path: '/groceries', session })

		const field = await addField(screen)
		await expect.element(field).toHaveFocus()
		await field.fill('milk')
		// Drawn as the item it will be, with its picture once it is named.
		await expectPageScreenshot(screen.container, 'groceries-draft')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByText('added to dairy & eggs'))
			.toBeVisible()
		await expect.element(field).toHaveFocus()

		// Enter on the empty row puts it away.
		await userEvent.keyboard('{Enter}')
		await expect.element(field).not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'add items' }))
			.toBeVisible()
		expect(list.items.map((item) => item.text)).toEqual(['milk'])
	})

	test('deletes with undo, behind a swipe or in edit', async () => {
		list.items = [make('1 onion')]
		const { screen } = await renderRoute({ path: '/groceries', session })
		const onion = screen.getByRole('checkbox', { name: '1 onion' })

		await expect.element(onion).toBeVisible()
		// The swipe's delete is out of reach until the row slides.
		await expect
			.element(screen.getByRole('button', { name: 'delete' }))
			.toHaveAttribute('inert')

		// Anywhere, edit deletes too.
		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('checkbox', { name: 'select 1 onion' }).click()
		await screen.getByRole('button', { name: 'delete' }).last().click()
		await expect.element(onion).not.toBeInTheDocument()
		expect(list.items).toEqual([])

		await screen.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(screen.getByRole('checkbox', { name: '1 onion' }))
			.toBeVisible()
		expect(list.items.map((item) => item.text)).toEqual(['1 onion'])
	})

	test('edits many items at once: bought or deleted', async () => {
		list.items = [make('1 onion'), make('2 tbsp butter'), make('paprika')]
		const { screen } = await renderRoute({ path: '/groceries', session })

		await screen.getByRole('button', { name: 'edit' }).click()

		const bar = screen.getByRole('toolbar', { name: 'editing' })
		const action = (name: string) => screen.getByRole('button', { name })

		// What to do shows once something is picked.
		await expect.element(action('delete')).not.toBeInTheDocument()
		await screen.getByRole('checkbox', { name: 'select 1 onion' }).click()
		await screen.getByRole('checkbox', { name: 'select paprika' }).click()
		await expect.element(bar.getByText('· 2 selected')).toBeVisible()
		await expect
			.element(bar.getByRole('checkbox', { name: /select all/ }))
			.toBePartiallyChecked()
		await expectPageScreenshot(screen.container, 'groceries-editing')

		await action('delete').click()
		await expect
			.poll(() => list.items.map((item) => item.text))
			.toEqual(['2 tbsp butter'])
		await page.getByRole('button', { name: 'undo' }).click()
		await expect.poll(() => list.items).toHaveLength(3)

		await screen.getByRole('button', { name: 'edit' }).click()
		await bar.getByRole('checkbox', { name: /select all/ }).click()
		await action('bought').click()
		await expect
			.poll(() => list.items.every((item) => item.checkedAt))
			.toBe(true)
		await expect
			.element(screen.getByRole('region', { name: 'all in the cart' }))
			.toBeVisible()
	})

	test('steps an amount on a phone without closing the row', async () => {
		if (window.innerWidth >= 768) return
		list.items = [make('1 onion')]
		const { screen } = await renderRoute({ path: '/groceries', session })

		await screen.getByRole('button', { name: 'add items' }).click()

		const field = screen.getByRole('combobox', { name: 'add an item' })

		await field.fill('milk')

		// A phone takes focus off the field as the plus is touched, before its
		// click; the row stays open and the plus still steps the amount.
		const more = screen.getByRole('button', { name: 'more' })

		more
			.element()
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		field.element().dispatchEvent(new FocusEvent('blur'))
		field.element().dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
		await more.click()

		await expect.element(field).toHaveValue('1 milk')
		await expect.element(field).toHaveFocus()
		expect(list.items.map((item) => item.text)).toEqual(['1 onion'])
	})
})
