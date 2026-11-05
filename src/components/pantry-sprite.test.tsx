import { describe, expect, test } from 'vite-plus/test'
import { render } from 'vitest-browser-react'

import { PantrySprite } from './pantry-sprite'

describe('PantrySprite', () => {
	test('paints a recolourable sprite under its outline and shading', async () => {
		const { container } = await render(
			<PantrySprite
				look={{ key: 'oil-bottle', tint: '#E4EEF0' }}
				className="size-24"
			/>,
		)

		const fill = container.querySelector('span[style*="--tint"]')
		const shading = container.querySelector('img')

		if (!(fill instanceof HTMLElement) || !shading)
			throw new Error('the sprite did not render its two layers')

		expect(getComputedStyle(fill).backgroundColor).toBe('rgb(228, 238, 240)')
		expect(getComputedStyle(fill).maskImage).toContain(
			'/sprites/pantry/tint/oil-bottle.fill.png',
		)
		expect(shading.getAttribute('src')).toBe(
			'/sprites/pantry/tint/oil-bottle.png',
		)
		await expect.poll(() => shading.naturalWidth).toBe(32)
	})

	test('draws any other sprite as one image', async () => {
		const { container } = await render(
			<PantrySprite look={{ key: 'apple' }} className="size-6" />,
		)

		expect(container.querySelectorAll('img')).toHaveLength(1)
		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			'/sprites/pantry/apple.png',
		)
		expect(container.querySelector('[style*="--tint"]')).toBeNull()
	})
})
