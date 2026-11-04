import { describe, expect, test } from 'vite-plus/test'

import {
	catalogSections,
	filterCatalogItems,
	normalizeIngredientName,
	sectionSprite,
} from './catalog'
import { pantryCategories } from './model'

describe('ingredient catalog', () => {
	test('stores normalized, unique names in every section', () => {
		for (const section of catalogSections) {
			for (const item of section.items) {
				expect(normalizeIngredientName(item)).toBe(item)
			}

			expect(new Set(section.items).size).toBe(section.items.length)
		}
	})

	test('has a section for every category, so each can be stocked', () => {
		expect(catalogSections.map((section) => section.id).sort()).toEqual(
			[...pantryCategories].sort(),
		)
	})

	test.each([
		['', 4],
		['pap', 2],
		['  SMOKED  pap ', 1],
		['pow', 1],
		['zzz', 0],
	])('filters %j to %i items by word prefix', (query, count) => {
		const items = ['paprika', 'smoked paprika', 'garlic powder', 'salt']

		expect(filterCatalogItems(items, query)).toHaveLength(count)
	})

	test('ignores accents and apostrophes when searching', () => {
		const items = ['jalapeños', "za'atar", 'salt']

		expect(filterCatalogItems(items, 'jalapeno')).toEqual(['jalapeños'])
		expect(filterCatalogItems(items, 'zaatar')).toEqual(["za'atar"])
	})
})

describe('sectionSprite', () => {
	test('shows the food in a section, not the category stand-in', () => {
		expect(sectionSprite(['1 lime', '2 limes'], 'fruit')).toBe('lime')
	})

	test('takes the food a section has most of, the first on a tie', () => {
		expect(sectionSprite(['1 apple', '2 limes', '1 lime'], 'fruit')).toBe(
			'lime',
		)
		expect(sectionSprite(['2 limes', '1 apple'], 'fruit')).toBe('lime')
	})

	test('falls back to the category picture for food with no sprite of its own', () => {
		expect(sectionSprite(['1 dragonfruit'], 'fruit')).toBe('apple')
		expect(sectionSprite([], 'vegetables')).toBe('carrot')
	})
})
