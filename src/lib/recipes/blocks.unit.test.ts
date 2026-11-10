import { describe, expect, test } from 'vite-plus/test'

import {
	blocksOf,
	flattenBlocks,
	gatherBlock,
	moveBlock,
	moveBlockTo,
} from './blocks'

// Upper case marks a head: "A" heads "a1" and "a2".
const isHead = (row: string) => row === row.toUpperCase()

describe('blocksOf', () => {
	test('groups rows under the head above them', () => {
		expect(blocksOf(['x', 'A', 'a1', 'B'], isHead)).toEqual([
			{ head: undefined, rows: ['x'] },
			{ head: 'A', rows: ['a1'] },
			{ head: 'B', rows: [] },
		])
	})

	test('flattens back to the same rows', () => {
		const rows = ['x', 'y', 'A', 'a1', 'B', 'b1', 'b2']

		expect(flattenBlocks(blocksOf(rows, isHead))).toEqual(rows)
	})
})

describe('moveBlock', () => {
	const rows = ['x', 'A', 'a1', 'a2', 'B', 'b1', 'C']

	test('moves a head with its rows down', () => {
		expect(moveBlock(rows, isHead, 'A', 'B')).toEqual([
			'x',
			'B',
			'b1',
			'A',
			'a1',
			'a2',
			'C',
		])
	})

	test('moves a head with its rows up', () => {
		expect(moveBlock(rows, isHead, 'C', 'A')).toEqual([
			'x',
			'C',
			'A',
			'a1',
			'a2',
			'B',
			'b1',
		])
	})

	test('keeps rows without a head first', () => {
		expect(moveBlock(rows, isHead, 'B', 'A')[0]).toBe('x')
	})

	test('leaves the rows alone for an unknown or same head', () => {
		expect(moveBlock(rows, isHead, 'A', 'A')).toEqual(rows)
		expect(moveBlock(rows, isHead, 'Z', 'A')).toEqual(rows)
	})
})

describe('moveBlockTo', () => {
	const rows = ['x', 'A', 'a1', 'a2', 'B', 'b1']

	test('takes a block to where the block of the row it lands on stands', () => {
		expect(moveBlockTo(rows, isHead, 'A', 'b1')).toEqual([
			'x',
			'B',
			'b1',
			'A',
			'a1',
			'a2',
		])
		expect(moveBlockTo(rows, isHead, 'B', 'a2')).toEqual([
			'x',
			'B',
			'b1',
			'A',
			'a1',
			'a2',
		])
	})

	test('stays put on its own rows, and below the rows with no head', () => {
		expect(moveBlockTo(rows, isHead, 'A', 'a1')).toEqual(rows)
		expect(moveBlockTo(rows, isHead, 'B', 'x')).toEqual([
			'x',
			'B',
			'b1',
			'A',
			'a1',
			'a2',
		])
	})
})

describe('gatherBlock', () => {
	const rows = ['x', 'y', 'A', 'a1', 'a2', 'B', 'b1']

	test('gathers loose rows into a block before the first head', () => {
		expect(gatherBlock(rows, isHead, new Set(['y']), 'N')).toEqual([
			'x',
			'N',
			'y',
			'A',
			'a1',
			'a2',
			'B',
			'b1',
		])
	})

	test('puts the block after the one its first row left', () => {
		expect(gatherBlock(rows, isHead, new Set(['a1', 'b1']), 'N')).toEqual([
			'x',
			'y',
			'A',
			'a2',
			'N',
			'a1',
			'b1',
			'B',
		])
	})

	test('takes every loose row', () => {
		expect(gatherBlock(rows, isHead, new Set(['x', 'y']), 'N')).toEqual([
			'N',
			'x',
			'y',
			'A',
			'a1',
			'a2',
			'B',
			'b1',
		])
	})

	test('leaves heads alone and changes nothing without a row', () => {
		expect(gatherBlock(rows, isHead, new Set(['A']), 'N')).toEqual(rows)
	})
})
