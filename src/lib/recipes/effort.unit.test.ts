import { describe, expect, test } from 'vite-plus/test'

import {
	effortLevel,
	effortPerMeal,
	keepingOf,
	shopEffort,
	stepWaits,
	timeSplit,
} from './effort'

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

	test('shares the work over the meals a recipe makes and keeps for', () => {
		const days = { days: '3–4 days', freezes: false }

		// A pot of chili for eight that freezes: an hour's work over four meals.
		expect(
			effortPerMeal(
				{
					activeMinutes: 60,
					foods: 14,
					servings: 8,
					keeps: { ...days, freezes: true },
				},
				8,
			),
		).toEqual({ work: 86, meals: 4, perMeal: 22 })
		expect(
			effortLevel(
				{
					activeMinutes: 60,
					foods: 14,
					servings: 8,
					keeps: { ...days, freezes: true },
				},
				8,
			),
		).toBe('low')
		// A fancy steak for two: less time, all of it for one meal.
		expect(
			effortLevel({ activeMinutes: 90, foods: 9, servings: 2, keeps: days }, 5),
		).toBe('high')
		// Waiting is not work: a slow braise, a few minutes to put together.
		expect(
			effortLevel(
				{
					activeMinutes: 15,
					totalMinutes: 180,
					foods: 8,
					servings: 4,
					keeps: days,
				},
				1,
			),
		).toBe('low')
	})

	test('says how fresh and spread out a shop is', () => {
		expect(shopEffort(['2 lb chicken thighs', 'cumin', 'onions'])).toEqual({
			buy: 3,
			fresh: 2,
			aisles: 3,
		})
	})
})
