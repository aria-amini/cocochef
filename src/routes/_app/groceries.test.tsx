import { renderRoute } from '@tests/support/render/route'
import {
	expectIsolatedScreenshot,
	expectPageScreenshot,
} from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

import { ingredientCategory } from '@/lib/recipes/ingredient-groups'

type Item = {
	id: string
	userId: string
	text: string
	category: ReturnType<typeof ingredientCategory>
	recipes: { id: string; title: string }[]
	checkedAt: Date | null
	createdAt: Date
}

// A read of the list the test holds back, to play a slow connection.
type HeldRead = { held?: Promise<void> | undefined }

const list = vi.hoisted(() => {
	const items: Item[] = []

	// Signed out, the server keeps no list.
	// Lines put away into the kitchen when the cart was cleared.
	const stocked: string[] = []

	// The next read of the list waits for this.
	const read: HeldRead = {}

	return { items, signedOut: false, stocked, read }
})

const make = (text: string, extra: Partial<Item> = {}): Item => ({
	id: crypto.randomUUID(),
	userId: 'user-1',
	text,
	category: ingredientCategory(text),
	recipes: [],
	checkedAt: null,
	createdAt: new Date(),
	...extra,
})

// What the cook already keeps, for the finish dialog to say what saving does.
const kept = vi.hoisted(() => {
	const items: { name: string; level: 'plenty' | 'low' | 'out' }[] = []

	return { items }
})

vi.mock('@/lib/pantry/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/pantry/server')>()),
	listPantry: () => Promise.resolve(kept.items),
}))

vi.mock('@/lib/groceries/server', () => ({
	// As the server has it when the read starts, however long it takes.
	listGroceries: async () => {
		const items = list.signedOut ? null : list.items

		await list.read.held

		return items
	},
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
		const ticked = list.items.filter((item) => item.checkedAt)
		list.stocked.push(...ticked.map((item) => item.id))
		list.items = list.items.filter((item) => !item.checkedAt)

		return Promise.resolve({
			cleared: ticked.length,
			restocked: 0,
			added: ticked.length,
			undo: { lines: [], topped: [], made: [] },
		})
	},
	restoreCart: () => Promise.resolve([]),
	leaveGrocery: vi.fn(),
}))

// The row items are added in, at the end of the list: opened by the add row,
// or the empty list's own.
async function addField(
	screen: Awaited<ReturnType<typeof renderRoute>>['screen'],
) {
	await screen.getByRole('button', { name: 'add grocery item' }).click()

	return screen.getByRole('combobox', { name: 'add an item' })
}

// Rows travel and counts pop as items are ticked: a screenshot waits for
// all of it to come to rest, or it catches a frame mid-move.
async function settled() {
	await expect
		.poll(() =>
			[
				...document.querySelectorAll<HTMLElement>(
					'li[style*="transform"], section[style*="transform"]',
				),
			].every((node) => ['', 'none'].includes(node.style.transform)),
		)
		.toBe(true)
}

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

describe('groceries', () => {
	beforeEach(() => {
		list.items = []
		list.signedOut = false
		list.read.held = undefined
		list.stocked.length = 0
		kept.items = []
	})

	test('invites an empty list to add, not to go elsewhere', async () => {
		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		await expect
			.element(screen.getByRole('region', { name: 'groceries' }))
			.toBeVisible()
		// Nothing to change, so no menu to change it by.
		await expect
			.element(screen.getByRole('button', { name: 'list options' }))
			.not.toBeInTheDocument()
		// Nothing in the cart, so nothing to put away.
		await expect
			.element(screen.getByRole('button', { name: 'put away' }))
			.not.toBeInTheDocument()
		await expectPageScreenshot(screen.container, 'groceries-empty')

		await screen.getByRole('button', { name: 'add grocery item' }).click()
		await expect
			.element(screen.getByRole('combobox', { name: 'add an item' }))
			.toHaveFocus()
	})

	test('shelves the list by aisle, and moves what is ticked into the kitchen', async () => {
		list.items = [
			make('2 cloves garlic', {
				recipes: [{ id: 'recipe-1', title: 'miso butter pasta' }],
			}),
			make('2 tbsp butter', {
				recipes: [{ id: 'recipe-1', title: 'miso butter pasta' }],
			}),
			make('1 onion'),
		]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		const vegetables = screen.getByRole('region', {
			name: 'vegetables & herbs',
		})

		const completed = screen.getByRole('region', { name: 'in your cart' })

		await expect
			.element(vegetables.getByRole('checkbox', { name: '1 onion' }))
			.toBeVisible()
		// Nothing is ticked yet: nothing in the kitchen, and nothing to put away.
		await expect.element(completed).not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'put away' }))
			.not.toBeInTheDocument()
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

		const order = () =>
			vegetables
				.getByRole('checkbox')
				.all()
				.map((box) => box.element().getAttribute('aria-label'))

		// A ticked item holds still while ticking goes on, so the next tap lands
		// where it was aimed, then moves to the completed box.
		await screen.getByRole('checkbox', { name: '2 cloves garlic' }).click()
		await expect
			.element(screen.getByRole('checkbox', { name: '2 cloves garlic' }))
			.toBeChecked()
		expect(order()).toEqual(['2 cloves garlic', '1 onion'])
		await expect.poll(order, { timeout: 3000 }).toEqual(['1 onion'])
		await expect
			.element(completed.getByRole('checkbox', { name: '2 cloves garlic' }))
			.toBeChecked()
		await settled()
		await expectPageScreenshot(screen.container, 'groceries-shopping')

		// A tick only puts it in the cart, and the header says how far along.
		await expect
			.element(screen.getByText(', 1 of 4 in your cart'))
			.toBeInTheDocument()
		expect(list.stocked).toEqual([])

		// One tap on the bar puts the cart away in the kitchen.
		await expect.element(screen.getByText('1 in your cart')).toBeVisible()
		await screen.getByRole('button', { name: 'put away' }).click()
		await expect.element(completed).not.toBeInTheDocument()
		expect(list.stocked).toHaveLength(1)
		expect(list.items.map((item) => item.text)).toEqual([
			'2 tbsp butter',
			'1 onion',
			'paprika',
		])
	})

	test('does not add an item already waiting, and takes one back out of the cart', async () => {
		list.items = [make('milk'), make('eggs', { checkedAt: new Date() })]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		const field = await addField(screen)

		await field.fill('Milk')
		await screen.getByRole('button', { name: 'add', exact: true }).click()
		await expect.element(screen.getByText('already on your list')).toBeVisible()
		expect(
			screen.getByRole('checkbox', { name: /^milk$/i }).all(),
		).toHaveLength(1)

		await field.fill('eggs')
		await screen.getByRole('button', { name: 'add', exact: true }).click()
		await expect.element(screen.getByText('back on your list')).toBeVisible()
		await expect
			.element(screen.getByRole('checkbox', { name: 'eggs' }))
			.not.toBeChecked()
		expect(list.items).toHaveLength(2)
	})

	test('in the shop, a tap anywhere on a row ticks it, and a tap in the completed box takes it back', async () => {
		list.items = [make('1 onion'), make('milk')]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		// The name is part of the target: there is nothing to open in the shop.
		await screen.getByText('1 onion').click()
		await expect.poll(() => list.items[0]?.checkedAt).toBeInstanceOf(Date)
		await expect
			.element(screen.getByRole('textbox', { name: /name of/ }))
			.not.toBeInTheDocument()

		// Once the ticking settles it sits in the completed box, and an aisle with
		// nothing left to find goes.
		const completed = screen.getByRole('region', { name: 'in your cart' })

		await expect
			.element(completed.getByRole('checkbox', { name: '1 onion' }), {
				timeout: 3000,
			})
			.toBeChecked()
		await expect
			.element(screen.getByRole('region', { name: 'vegetables & herbs' }))
			.not.toBeInTheDocument()

		await completed.getByText('1 onion').click()
		await expect.poll(() => list.items[0]?.checkedAt).toBeNull()
		await expect
			.element(
				screen
					.getByRole('region', { name: 'vegetables & herbs' })
					.getByRole('checkbox', { name: '1 onion' }),
				{ timeout: 3000 },
			)
			.not.toBeChecked()
	})

	test('keeps ticks shown while the list is slow to read again', async () => {
		list.items = [make('1 onion'), make('milk')]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		const ticked = (name: string) => {
			const box = screen.getByRole('checkbox', { name }).element()

			return box instanceof HTMLInputElement && box.checked
		}

		// On a slow connection the list's read after a tick takes a while, and
		// the cook ticks the next item meanwhile.
		let arrive = () => {}

		list.read.held = new Promise((resolve) => {
			arrive = resolve
		})
		await screen.getByText('1 onion').click()
		await expect.poll(() => list.items[0]?.checkedAt).toBeInstanceOf(Date)
		await screen.getByText('milk').click()
		await expect.poll(() => list.items[1]?.checkedAt).toBeInstanceOf(Date)
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(ticked('1 onion')).toBe(true)
		expect(ticked('milk')).toBe(true)

		arrive()
		await new Promise((resolve) => setTimeout(resolve, 500))
		expect(ticked('1 onion')).toBe(true)
		expect(ticked('milk')).toBe(true)
	})

	test('editing, changes each item in place', async () => {
		list.items = [
			make('1 onion', {
				recipes: [
					{ id: 'recipe-2', title: 'french onion soup' },
					{ id: 'recipe-1', title: 'miso butter pasta' },
				],
			}),
			make('milk'),
		]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		// In the shop a row is the food's name alone: the recipes it is for are
		// said where the list is changed.
		await expect
			.element(screen.getByText('french onion soup'))
			.not.toBeInTheDocument()

		await screen.getByRole('button', { name: 'list options' }).click()
		await page.getByRole('menuitem', { name: 'edit list' }).click()
		// Each recipe it is for is a way back to it.
		await expect
			.element(screen.getByRole('link', { name: 'french onion soup' }))
			.toHaveAttribute('href', '/recipes/recipe-2')
		await expect
			.element(screen.getByRole('link', { name: 'miso butter pasta' }))
			.toHaveAttribute('href', '/recipes/recipe-1')
		// Done takes the menu's place while the list is being changed.
		await expect
			.element(screen.getByRole('button', { name: 'done' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'list options' }))
			.not.toBeInTheDocument()

		// The amount steps in a shop's units, right on the row.
		const more = screen.getByRole('button', { name: 'more onion' })
		const moreButton = more.element()

		await more.click()
		await expect.poll(() => list.items[0]?.text).toBe('2 onion')
		// Stepping keeps the row, so keyboard focus on the button isn't lost.
		expect(moreButton.isConnected).toBe(true)

		// The name is retyped in place and keeps its amount.
		const name = screen.getByRole('textbox', { name: 'name of 2 onion' })

		await name.fill('red onion')
		await userEvent.keyboard('{Enter}')
		await expect.poll(() => list.items[0]?.text).toBe('2 red onion')
		await expectPageScreenshot(screen.container, 'groceries-edit')

		// Escape takes an edit back: nothing is saved for it.
		const renamed = screen.getByRole('textbox', { name: 'name of 2 red onion' })

		await renamed.fill('purple onion')
		await userEvent.keyboard('{Escape}')
		await expect.element(renamed).toHaveValue('red onion')
		expect(list.items[0]?.text).toBe('2 red onion')

		// The amount's label opens its units; a new unit starts over.
		await screen
			.getByRole('button', { name: 'amount of red onion, change units' })
			.click()
		const sheet = page.getByRole('dialog', { name: '2 red onion' })

		await expect
			.element(sheet.getByRole('link', { name: 'french onion soup' }))
			.toHaveAttribute('href', '/recipes/recipe-2')
		await expect
			.element(sheet.getByRole('link', { name: 'miso butter pasta' }))
			.toBeVisible()
		await sheet.getByRole('button', { name: 'lb' }).click()
		await expect
			.element(sheet.getByRole('textbox'))
			.toHaveValue('1 lb red onion')
		await expectIsolatedScreenshot(sheet, 'groceries-item')
		await sheet.getByRole('button', { name: 'done' }).click()
		await expect.poll(() => list.items[0]?.text).toBe('1 lb red onion')

		// Done goes back to the shop, where each row ticks again.
		await screen.getByRole('button', { name: 'done' }).click()
		await expect
			.element(screen.getByRole('checkbox', { name: '1 lb red onion' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('textbox', { name: /name of/ }))
			.not.toBeInTheDocument()
	})

	test('keeps what is ticked in a box that folds', async () => {
		list.items = [make('1 onion'), make('soy sauce', { checkedAt: new Date() })]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		const completed = screen.getByRole('region', { name: 'in your cart' })
		const fold = completed.getByRole('button', { name: /in your cart/ })

		await expect.element(fold).toHaveAttribute('aria-expanded', 'true')
		await expect
			.element(completed.getByRole('checkbox', { name: 'soy sauce' }))
			.toBeChecked()

		// Its name folds it to one line with a count, and opens it again.
		await fold.click()
		await expect.element(fold).toHaveAttribute('aria-expanded', 'false')
		await expect.element(completed.getByText('· 1')).toBeVisible()
		await expect
			.element(completed.getByRole('checkbox', { name: 'soy sauce' }))
			.not.toBeInTheDocument()
		await fold.click()
		await expect
			.element(completed.getByRole('checkbox', { name: 'soy sauce' }))
			.toBeChecked()

		// With everything ticked, only the kitchen's box is left.
		await screen.getByRole('checkbox', { name: '1 onion' }).click()
		await expect
			.element(completed.getByRole('checkbox', { name: '1 onion' }), {
				timeout: 3000,
			})
			.toBeChecked()
		await expect
			.element(screen.getByRole('region', { name: 'vegetables & herbs' }))
			.not.toBeInTheDocument()
		await settled()
		await expectPageScreenshot(screen.container, 'groceries-done')
	})

	test('puts the whole cart away in one tap, and says so', async () => {
		const milk = make('milk', { checkedAt: new Date() })
		const eggs = make('eggs', { checkedAt: new Date() })
		list.items = [milk, eggs, make('1 onion')]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		await expect.element(screen.getByText('2 in your cart')).toBeVisible()
		await screen.getByRole('button', { name: 'put away' }).click()

		await expect
			.element(screen.getByRole('region', { name: 'in your cart' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'put away' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByText('put 2 items away in on hand'))
			.toBeVisible()
		expect(list.stocked).toEqual([milk.id, eggs.id])
		expect(list.items.map((item) => item.text)).toEqual(['1 onion'])
	})

	test('finishes a food from its first letters, and steps its amount', async () => {
		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

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

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

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
			.element(screen.getByRole('button', { name: 'add grocery item' }))
			.toBeVisible()
		expect(list.items.map((item) => item.text)).toEqual(['milk'])
	})

	test('in the shop, a swipe left takes a row off the list, untouched by the pantry', async () => {
		list.items = [make('milk'), make('eggs')]

		const { screen } = await renderRoute({ path: '/groceries', session })
		const milk = screen.getByRole('checkbox', { name: 'milk' })

		await expect.element(milk).toBeVisible()

		// A finger on the row, dragged well to the left and let go.
		const row = milk.element().closest('label')

		if (!row) throw new Error('missing row')

		const box = row.getBoundingClientRect()
		const y = box.top + box.height / 2

		const at = (type: string, x: number) =>
			new PointerEvent(type, {
				bubbles: true,
				clientX: x,
				clientY: y,
				pointerId: 1,
				isPrimary: true,
				pointerType: 'touch',
				buttons: type === 'pointerup' ? 0 : 1,
			})

		row.dispatchEvent(at('pointerdown', box.right - 20))

		for (let step = 1; step <= 8; step++) {
			window.dispatchEvent(at('pointermove', box.right - 20 - step * 25))
			await new Promise((done) => requestAnimationFrame(done))
		}

		window.dispatchEvent(at('pointerup', box.right - 220))

		await expect
			.poll(() => list.items.map((item) => item.text))
			.toEqual(['eggs'])
		// Gone, not ticked: nothing for putting away to stock.
		expect(list.stocked).toEqual([])
		await expect.element(page.getByText('removed milk')).toBeVisible()
	})

	test('editing, takes an item off with undo', async () => {
		list.items = [make('1 onion')]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		await screen.getByRole('button', { name: 'list options' }).click()
		await page.getByRole('menuitem', { name: 'edit list' }).click()
		await screen.getByRole('button', { name: 'remove 1 onion' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'name of 1 onion' }))
			.not.toBeInTheDocument()
		expect(list.items).toEqual([])

		await screen.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'name of 1 onion' }))
			.toBeVisible()
		expect(list.items.map((item) => item.text)).toEqual(['1 onion'])
	})

	test('steps an amount on a phone without closing the row', async () => {
		if (window.innerWidth >= 768) return
		list.items = [make('1 onion')]

		const { screen } = await renderRoute({
			path: '/groceries',
			session,
		})

		await screen.getByRole('button', { name: 'add grocery item' }).click()

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
