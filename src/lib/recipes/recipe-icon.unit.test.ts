import {
	BirdIcon,
	BowlSteamIcon,
	CakeIcon,
	CookingPotIcon,
	GrainsIcon,
	IceCreamIcon,
	PizzaIcon,
} from '@phosphor-icons/react'
import { describe, expect, test } from 'vite-plus/test'

import { recipeIcon } from './recipe-icon'

describe('recipeIcon', () => {
	test.each([
		['Margherita Pizza', PizzaIcon],
		['Lemon Chicken', BirdIcon],
		['Lemon cakes', CakeIcon],
		['Salted caramel ice cream', IceCreamIcon],
		['Weeknight pasta', GrainsIcon],
	])('guesses an icon for %s', (title, icon) => {
		expect(recipeIcon(title)).toBe(icon)
	})

	test('puts the dish before its main ingredient', () => {
		expect(recipeIcon('Chicken noodle soup')).toBe(BowlSteamIcon)
	})

	test('matches whole words only', () => {
		expect(recipeIcon('Subtle spice blend')).toBe(CookingPotIcon)
		expect(recipeIcon('Hot sauce')).toBe(CookingPotIcon)
	})

	test('falls back to a pot for a name it knows nothing about', () => {
		expect(recipeIcon('Grandma’s Sunday thing')).toBe(CookingPotIcon)
		expect(recipeIcon('')).toBe(CookingPotIcon)
	})
})
