import { describe, expect, test } from 'vite-plus/test'

import { keepingOf, mealsOf, stepWaits, timeSplit } from './effort'

describe('effort', () => {
	test('counts what the steps say to wait out, to the end of a range', () => {
		expect(
			stepWaits([
				'Brown the beef in batches.',
				'Cover and simmer for 2 to 3 hours, until tender. Stir now and then.',
				'Let it rest 10 minutes before serving.',
			]),
		).toEqual({ minutes: 190, dayBefore: false, waits: ['simmer', 'rest'] })
	})

	test('reads "an hour" and "1 1/2 hours", and no time for hands-on steps', () => {
		expect(stepWaits(['Chill for an hour.']).minutes).toBe(60)
		expect(stepWaits(['Bake 1 1/2 hours.']).minutes).toBe(90)
		expect(stepWaits(['Sauté the onions for 8 minutes.']).minutes).toBe(0)
	})

	test('counts a sit on the counter, not a few minutes of frying', () => {
		expect(
			stepWaits([
				'Cut the tofu, and let it sit at room temperature for 30 minutes.',
				'Deep fry the tofu (about 2 to 3 minutes per batch) and set aside.',
			]),
		).toEqual({ minutes: 30, dayBefore: false, waits: ['rest'] })
	})

	test('starts the day before for a night in the fridge', () => {
		expect(
			stepWaits(['Marinate the chicken overnight in the fridge.']),
		).toEqual({ minutes: 0, dayBefore: true, waits: ['marinate'] })
	})

	test('splits the whole time, never waiting past it', () => {
		expect(
			timeSplit({
				totalMinutes: 180,
				prepMinutes: 20,
				steps: ['Braise for 2 1/2 hours.'],
			}),
		).toMatchObject({ activeMinutes: 30, waitingMinutes: 150 })
		expect(
			timeSplit({ totalMinutes: 60, steps: ['Slow cook 8 hours.'] }),
		).toMatchObject({ activeMinutes: 5, waitingMinutes: 55 })
	})

	test('freezes by what the dish is, not a sauce in its foods', () => {
		expect(keepingOf('Braised mackerel').freezes).toBe(false)
	})

	test('keeps cooked food 3–4 days, and raw fish only the day', () => {
		expect(keepingOf('Beef stew')).toEqual({
			days: '3–4 days',
			freezes: true,
		})
		expect(keepingOf('Salmon ceviche')).toEqual({
			days: 'the same day',
			freezes: false,
		})
	})

	test('counts the meals a recipe makes for two, as long as it keeps', () => {
		const days = { days: '3–4 days', freezes: false }

		// A pot of chili for eight that freezes: four meals.
		expect(mealsOf({ servings: 8, keeps: { ...days, freezes: true } })).toBe(4)
		// A big batch that keeps only the fridge's days: three at most.
		expect(mealsOf({ servings: 12, keeps: days })).toBe(3)
		// Raw fish is for the day: one, however many it serves.
		expect(
			mealsOf({ servings: 6, keeps: { days: 'the same day', freezes: false } }),
		).toBe(1)
		// Unknown until the page or the cook says how many it serves.
		expect(mealsOf({ keeps: days })).toBeUndefined()
	})
})
