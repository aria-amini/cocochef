import { describe, expect, test } from 'vite-plus/test'

import { lineCompletion } from './amount-bar'

describe('lineCompletion', () => {
	test('finishes a food typed with no amount', () => {
		expect(lineCompletion.query('salm')).toBe('salm')
		expect(lineCompletion.apply('salm', 'salmon')).toBe('salmon')
	})

	test('finishes the food after a finished amount, keeping it', () => {
		expect(lineCompletion.query('2 lb salm')).toBe('salm')
		expect(lineCompletion.apply('2 lb salm', 'salmon')).toBe('2 lb salmon')
	})

	test('waits while the amount is still being typed', () => {
		expect(lineCompletion.query('2')).toBe('')
		expect(lineCompletion.query('12')).toBe('')
	})
})
