import { describe, expect, test } from 'vite-plus/test'

import {
	checkableStepIndexes,
	formatSubStep,
	isSubStep,
	stepRows,
} from './step-groups'

describe('stepRows', () => {
	test('nests sub-steps under the step above them', () => {
		expect(
			stepRows([
				'Soak beans',
				'Prep meat',
				'- Clean sink',
				'- Cut meat',
				'Cook for 2 hours',
			]),
		).toEqual([
			{ kind: 'step', text: 'Soak beans', index: 0, label: '1' },
			{
				kind: 'group',
				text: 'Prep meat',
				index: 1,
				label: '2',
				children: [
					{ text: 'Clean sink', index: 2, label: '2.1' },
					{ text: 'Cut meat', index: 3, label: '2.2' },
				],
			},
			{ kind: 'step', text: 'Cook for 2 hours', index: 4, label: '3' },
		])
	})

	test('treats a sub-step with nothing above it as a step', () => {
		expect(stepRows(['- Stir', 'Serve'])).toEqual([
			{ kind: 'step', text: 'Stir', index: 0, label: '1' },
			{ kind: 'step', text: 'Serve', index: 1, label: '2' },
		])
	})

	test('does not nest later sub-steps under a leading sub-step', () => {
		expect(
			stepRows(['- Preheat', '- Mix', '- Bake']).map((row) => row.kind),
		).toEqual(['step', 'step', 'step'])
	})

	test('keeps flat recipes as they were', () => {
		expect(stepRows(['Boil', 'Drain']).map((row) => row.kind)).toEqual([
			'step',
			'step',
		])
	})
})

describe('checkableStepIndexes', () => {
	test('skips a group label and keeps its sub-steps', () => {
		expect(checkableStepIndexes(['Prep', '- Wash', '- Chop', 'Cook'])).toEqual([
			1, 2, 3,
		])
	})
})

describe('sub-step lines', () => {
	test('recognizes and writes the marker', () => {
		expect(isSubStep('- Wash')).toBe(true)
		expect(isSubStep('-5 degrees')).toBe(false)
		expect(isSubStep('Wash')).toBe(false)
		expect(formatSubStep('  Wash ')).toBe('- Wash')
		expect(formatSubStep('   ')).toBe('')
	})
})
