import { describe, expect, test } from 'vite-plus/test'

import { sizedPhoto } from './sized'

describe('a recipe photo sized for where it is drawn', () => {
	test('sends a site’s photo through the resizer, its address kept whole', () => {
		expect(
			sizedPhoto('https://example.com/a photo.jpg?w=2000&h=1500', 400),
		).toBe(
			'/api/img?w=400&u=https%3A%2F%2Fexample.com%2Fa%20photo.jpg%3Fw%3D2000%26h%3D1500',
		)
	})

	test('leaves an uploaded photo at its own address', () => {
		expect(sizedPhoto('/api/photos/recipes/owner-1234', 800)).toBe(
			'/api/photos/recipes/owner-1234',
		)
	})
})
