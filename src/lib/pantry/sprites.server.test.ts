import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vite-plus/test'

import { pantrySprites, resolveSpriteSrc } from './sprites'
import { tintedFamilySprites, tintedSpriteKeys } from './tinted-sprites'

// Checks the sprite files on disk, so it runs with the server tests.
describe('ingredient sprite assets', () => {
	test('resolves every declared alias to an existing asset', () => {
		for (const entry of pantrySprites) {
			for (const alias of entry.aliases) {
				expect(
					existsSync(resolve('public', `.${resolveSpriteSrc(alias)}`)),
				).toBe(true)
			}
		}
	})

	test('has the shading and fill files for every recolourable sprite', () => {
		for (const key of tintedSpriteKeys) {
			for (const file of [`${key}.png`, `${key}.fill.png`]) {
				expect(existsSync(resolve('public/sprites/pantry/tint', file))).toBe(
					true,
				)
			}
		}
	})

	test('only paints sprites that are declared recolourable', () => {
		const declared = new Set<string>(tintedSpriteKeys)

		for (const [key, , tint] of tintedFamilySprites) {
			if (tint) expect(declared.has(key)).toBe(true)
			else
				expect(existsSync(resolve('public/sprites/pantry', `${key}.png`))).toBe(
					true,
				)
		}
	})
})
