import { writeFileSync } from 'node:fs'

import { afterAll, describe, expect, test } from 'vite-plus/test'

import corpus from '../../../tests/support/fixtures/recipe-corpus.json'
import { ingredientItemSprite } from '../pantry/sprites'
import { ingredientCategory } from './ingredient-groups'
import { ingredientHeading, ingredientSubject } from './ingredient-line'
import { recipeIcon } from './recipe-icon'

// Real recipes from many sites (tests/support/fixtures/recipe-corpus.json,
// built by `vp run recipes:corpus`), to hold the ingredient and icon
// heuristics to a coverage floor. The floors sit just under what the
// heuristics reach today: raise them when coverage improves, and a drop means
// a change broke recipes it was not looking at.
//
// To see what is missing, run
// `CORPUS_REPORT=/tmp/corpus.txt vp test run recipe-corpus`: it writes the
// coverage and the most common ingredients no sprite or category
// recognizes to that file.
const floors = {
	// Ingredients that get any sprite; the rest leave an empty slot.
	sprite: 0.92,
	// Ingredients that get a picture of their own, not a generic jar or crate.
	ownSprite: 0.74,
	// Ingredients that land in a shopping category other than "other".
	category: 0.88,
	// Recipe titles that get an icon other than the default pot.
	titleIcon: 0.72,
}

// The reader shows each line as written, so the heuristics get the raw line.
const lines = corpus.flatMap((recipe) =>
	recipe.ingredients
		.filter((line) => ingredientHeading(line) === undefined)
		.map((line) => ({ site: recipe.site, line })),
)

const hasSprite = (line: string) => ingredientItemSprite(line) !== undefined

// Generic fallbacks (a spice jar, a vegetable) are right in kind but not the
// ingredient itself.
const hasOwnSprite = (line: string) =>
	!(ingredientItemSprite(line) ?? 'fallback').startsWith('fallback')

const hasCategory = (line: string) => ingredientCategory(line) !== 'other'

const share = (rows: { line: string }[], test: (line: string) => boolean) =>
	rows.filter(({ line }) => test(line)).length / rows.length

const defaultIcon = recipeIcon('')

const titleIconShare = () =>
	corpus.filter((recipe) => recipeIcon(recipe.title) !== defaultIcon).length /
	corpus.length

const reportPath = process.env.CORPUS_REPORT

const reportLines: string[] = []

function report(title: string, test: (line: string) => boolean) {
	const counts = new Map<string, number>()

	// Grouped by food, so "1 tsp pepper" and "½ tsp pepper" count together.
	for (const { line } of lines)
		if (!test(line)) {
			const food =
				ingredientSubject(line).split(/[,;(]/, 1)[0]?.trim().toLowerCase() ??
				line

			counts.set(food, (counts.get(food) ?? 0) + 1)
		}

	const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 60)

	reportLines.push(
		`\n${title}: ${counts.size} foods`,
		...top.map(([line, n]) => `${String(n).padStart(4)}  ${line}`),
	)
}

afterAll(() => {
	if (reportPath) writeFileSync(reportPath, `${reportLines.join('\n')}\n`)
})

describe('recipe corpus', () => {
	test('covers many sites and recipes', () => {
		expect(corpus.length).toBeGreaterThanOrEqual(900)

		expect(
			new Set(corpus.map((recipe) => recipe.site)).size,
		).toBeGreaterThanOrEqual(8)

		for (const recipe of corpus) {
			expect(recipe.title).not.toBe('')
			expect(recipe.ingredients.length).toBeGreaterThan(0)
		}
	})

	test('most ingredients get a sprite', () => {
		report('no sprite', hasSprite)
		expect(share(lines, hasSprite)).toBeGreaterThan(floors.sprite)
	})

	test('most ingredients get their own sprite, not a generic one', () => {
		report('only a generic sprite', hasOwnSprite)
		expect(share(lines, hasOwnSprite)).toBeGreaterThan(floors.ownSprite)
	})

	test('most ingredients land in a shopping category', () => {
		report('uncategorized', hasCategory)
		expect(share(lines, hasCategory)).toBeGreaterThan(floors.category)
	})

	test('most recipe titles get an icon of their own, not the default pot', () => {
		expect(titleIconShare()).toBeGreaterThan(floors.titleIcon)
	})

	test('writes the coverage summary when asked', () => {
		if (!reportPath) return

		const percent = (value: number) => `${(100 * value).toFixed(1)}%`
		const sites = [...new Set(lines.map(({ site }) => site))]

		reportLines.unshift(
			[
				`${lines.length} ingredient lines in ${corpus.length} recipes`,
				`any sprite:    ${percent(share(lines, hasSprite))}`,
				`own sprite:    ${percent(share(lines, hasOwnSprite))}`,
				`categorized:   ${percent(share(lines, hasCategory))}`,
				`title icon:    ${percent(titleIconShare())}`,
				'',
				'any sprite, by site:',
				...sites.map(
					(site) =>
						`  ${site.padEnd(24)} ${percent(
							share(
								lines.filter((row) => row.site === site),
								hasSprite,
							),
						)}`,
				),
			].join('\n'),
		)
	})
})
