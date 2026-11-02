import { z } from 'zod'

import type { RecipeIngredient } from '@/db/schema'
import {
	formatIngredientHeading,
	ingredientHeading,
} from '@/lib/recipes/ingredient-line'
import { recipeImageUrl } from '@/lib/recipes/model'

export type ImportedRecipe = {
	title: string
	imageUrl?: string | undefined
	ingredients: RecipeIngredient[]
	steps: string[]
}

// ===== Shared =====

const ENTITY_MAP = new Map([
	['amp', '&'],
	['lt', '<'],
	['gt', '>'],
	['quot', '"'],
	['apos', "'"],
	['nbsp', ' '],
])

function decodeEntities(text: string) {
	return text.replaceAll(/&(#x?[\da-f]+|\w+);/gi, (entity, body: string) => {
		if (body.startsWith('#x') || body.startsWith('#X'))
			return decodeCodePoint(Number.parseInt(body.slice(2), 16), entity)

		if (body.startsWith('#'))
			return decodeCodePoint(Number.parseInt(body.slice(1), 10), entity)

		return ENTITY_MAP.get(body.toLowerCase()) ?? entity
	})
}

function decodeCodePoint(codePoint: number, entity: string) {
	if (Number.isNaN(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
		return entity

	return String.fromCodePoint(codePoint)
}

function stripTags(html: string) {
	return (
		decodeEntities(
			html
				.replaceAll(/<script\b[\s\S]*?<\/script>/gi, ' ')
				.replaceAll(/<style\b[\s\S]*?<\/style>/gi, ' ')
				.replaceAll(/<[^>]+>/g, ' '),
		)
			.replaceAll(/\s+/g, ' ')
			// Tags stripped from inside brackets and before punctuation leave spaces
			// behind, and some sites wrap amounts in two sets of brackets.
			.replaceAll(/\(\s+/g, '(')
			.replaceAll(/\s+([),.;:!?])/g, '$1')
			.replaceAll(/\(\(([^()]*)\)\)/g, '($1)')
			.trim()
	)
}

function attrMap(tag: string) {
	const attrs: Record<string, string> = {}

	for (const match of tag.matchAll(
		/([\w-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g,
	))
		attrs[match[1]?.toLowerCase() ?? ''] = decodeEntities(
			match[3] ?? match[4] ?? match[5] ?? '',
		)

	return attrs
}

function* eachTag(html: string, name: string) {
	const pattern = new RegExp(`<${name}\\b[^>]*>`, 'gi')

	for (const match of html.matchAll(pattern)) yield match[0]
}

function metaContent(html: string, key: 'property' | 'name', value: string) {
	for (const tag of eachTag(html, 'meta')) {
		const attrs = attrMap(tag)

		if (attrs[key]?.toLowerCase() === value && attrs['content'])
			return attrs['content']
	}

	return undefined
}

function closingTagStart(html: string, tag: string, from: number) {
	const pattern = new RegExp(`</?${tag}\\b[^>]*>`, 'gi')
	pattern.lastIndex = from
	let depth = 1

	for (const match of html.matchAll(pattern)) {
		if (match[0].startsWith('</')) depth -= 1
		else if (!match[0].endsWith('/>')) depth += 1

		if (depth === 0) return match.index
	}

	return html.length
}

function elementTexts(html: string, attr: string, value: string) {
	const texts: string[] = []

	const pattern = new RegExp(
		`<([a-z]\\w*)\\b[^>]*\\b${attr}\\s*=\\s*("${value}"|'${value}'|${value})[^>]*>`,
		'gi',
	)

	for (const match of html.matchAll(pattern)) {
		if (match[0].endsWith('/>')) continue
		const start = match.index + match[0].length
		const end = closingTagStart(html, match[1] ?? '', start)
		const text = stripTags(html.slice(start, end))

		if (text) texts.push(text)
	}

	return texts
}

// ===== JSON-LD =====

type Json = z.infer<ReturnType<typeof z.json>>

const jsonLdNode = z.looseObject({
	'@type': z
		.union([z.string().transform((type) => [type]), z.array(z.string())])
		.transform((types) => types.map((type) => type.toLowerCase()))
		.optional(),
	'@graph': z.array(z.json()).optional(),
})

function* candidateNodes(parsed: Json): Generator<z.infer<typeof jsonLdNode>> {
	const queue = [parsed]

	while (queue.length > 0) {
		const value = queue.shift()

		if (Array.isArray(value)) {
			queue.push(...value)
			continue
		}

		const result = jsonLdNode.safeParse(value)

		if (!result.success) continue
		yield result.data

		if (result.data['@graph']) queue.push(...result.data['@graph'])
	}
}

const text = z.string().transform(stripTags)

// Some publishers use named ItemLists instead of Google's flat string list.
const ingredientList: z.ZodType<string[]> = z.lazy(() =>
	z
		.union([
			text.transform((line) => (line ? [line] : [])),
			z.array(ingredientList).transform((lists) => lists.flat()),
			z
				.looseObject({
					name: text.optional(),
					text: text.optional(),
					value: z.union([text, z.number()]).optional(),
					unitText: text.optional(),
					item: ingredientList.optional(),
					itemListElement: ingredientList.optional(),
				})
				.transform((node) => {
					const children = node.itemListElement ?? node.item

					if (children) {
						const heading =
							node.itemListElement &&
							node.name &&
							node.name.toLowerCase() !== 'ingredients'
								? formatIngredientHeading(node.name)
								: undefined

						return heading && children.length
							? [heading, ...children]
							: children
					}

					const line =
						node.value !== undefined
							? [node.value, node.unitText, node.name]
									.filter((part) => part !== undefined && part !== '')
									.join(' ')
							: (node.text ?? node.name)

					return line ? [line] : []
				}),
		])
		.catch([]),
)

// Recover only source-authored sections from recognized recipe-card markup.
// Exact, ordered matching prevents unrelated lists from replacing JSON-LD.
function withHtmlIngredientGroups(html: string, lines: string[]) {
	if (
		!lines.length ||
		lines.some((line) => ingredientHeading(line) !== undefined)
	)
		return lines

	const normalize = (line: string) =>
		line
			.replace(/^[□▢☐]\s*/, '')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase()

	const tags = /<([a-z]\w*)\b[^>]*>/gi

	for (const container of html.matchAll(tags)) {
		const classes = (attrMap(container[0])['class'] ?? '').split(/\s+/)
		const wprm = classes.includes('wprm-recipe-ingredients-container')

		const tasty =
			classes.includes('tasty-recipes-ingredients') ||
			classes.includes('tasty-recipes-ingredients-body')

		if (!wprm && !tasty) continue
		const start = container.index + container[0].length

		const scope = html.slice(
			start,
			closingTagStart(html, container[1] ?? '', start),
		)

		let index = 0
		let heading: string | undefined
		const grouped: string[] = []
		let mismatch = false

		for (const node of scope.matchAll(/<(h[2-6]|li|div|span)\b[^>]*>/gi)) {
			const nodeClasses = (attrMap(node[0])['class'] ?? '').split(/\s+/)

			const isHeading =
				/^h/i.test(node[1] ?? '') ||
				nodeClasses.includes('wprm-recipe-group-name')

			const isIngredient = wprm
				? nodeClasses.includes('wprm-recipe-ingredient')
				: node[1]?.toLowerCase() === 'li'

			if (!isHeading && !isIngredient) continue
			const contentStart = node.index + node[0].length

			const content = stripTags(
				scope.slice(
					contentStart,
					closingTagStart(scope, node[1] ?? '', contentStart),
				),
			)

			if (isHeading) {
				heading = content
				continue
			}

			const original = lines[index]

			if (
				original === undefined ||
				normalize(content) !== normalize(original)
			) {
				mismatch = true
				break
			}

			if (heading) {
				grouped.push(formatIngredientHeading(heading))
				heading = undefined
			}

			grouped.push(original)
			index += 1
		}

		if (!mismatch && index === lines.length) return grouped
	}

	return lines
}

const image: z.ZodType<string | undefined> = z.lazy(() =>
	z
		.union([
			z.string(),
			z.looseObject({ url: z.string() }).transform((node) => node.url),
			z.array(image).transform((urls) => urls.find(Boolean)),
		])
		.catch(undefined),
)

const instructionStep: z.ZodType<string[]> = z.lazy(() =>
	z
		.union([
			text.transform((step) => (step ? [step] : [])),
			z
				.looseObject({
					text: text.catch(''),
					itemListElement: z
						.array(instructionStep)
						.transform((groups) => groups.flat())
						.catch([]),
				})
				.transform((step) => (step.text ? [step.text] : step.itemListElement)),
		])
		.catch([]),
)

const instructions = z
	.union([
		z.string().transform((lines) =>
			lines
				.split(/\r?\n/)
				.map((line) => stripTags(line))
				.filter(Boolean),
		),
		z.array(instructionStep).transform((groups) => groups.flat()),
		instructionStep,
	])
	.catch([])

const recipeFields = z.object({
	name: z
		.string()
		.transform((name) => decodeEntities(name).trim())
		.catch(''),
	image,
	recipeIngredient: ingredientList,
	recipeInstructions: instructions,
})

function parseJsonLd(html: string): ImportedRecipe | null {
	const blocks = html.matchAll(
		/<script\b[^>]*\btype\s*=\s*("application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi,
	)

	for (const block of blocks) {
		let json: unknown

		try {
			json = JSON.parse(block[2] ?? '')
		} catch {
			continue
		}

		const parsed = z.json().safeParse(json)

		if (!parsed.success) continue

		for (const node of candidateNodes(parsed.data)) {
			if (!node['@type']?.includes('recipe')) continue

			const fields = recipeFields.parse(node)

			if (!fields.name) continue

			return {
				title: fields.name,
				imageUrl: fields.image,
				ingredients: withHtmlIngredientGroups(
					html,
					fields.recipeIngredient,
				).map((raw) => ({ raw })),
				steps: fields.recipeInstructions,
			}
		}
	}

	return null
}

// ===== Microdata =====

function recipeScope(html: string) {
	const pattern = /<([a-z]\w*)\b[^>]*\bitemscope\b[^>]*>/gi

	for (const match of html.matchAll(pattern)) {
		const attrs = attrMap(match[0])

		if (!attrs['itemtype']?.toLowerCase().endsWith('/recipe')) continue

		if (match[0].endsWith('/>')) return match[0]
		const start = match.index + match[0].length

		return html.slice(start, closingTagStart(html, match[1] ?? '', start))
	}

	return null
}

function parseMicrodata(html: string): ImportedRecipe | null {
	const scope = recipeScope(html)

	if (!scope) return null

	const ingredients = [
		...elementTexts(scope, 'itemprop', 'recipeIngredient'),
		...elementTexts(scope, 'itemprop', 'ingredients'),
	].map((raw) => ({ raw }))

	const steps = elementTexts(scope, 'itemprop', 'recipeInstructions')
	let title = elementTexts(scope, 'itemprop', 'name')[0]
	let image: string | undefined

	for (const tag of eachTag(scope, 'meta')) {
		const attrs = attrMap(tag)

		if (attrs['itemprop'] === 'name' && attrs['content'])
			title ??= attrs['content']

		if (attrs['itemprop'] === 'image' && attrs['content'])
			image ??= attrs['content']
	}

	for (const tag of eachTag(scope, 'img')) {
		const attrs = attrMap(tag)

		if (attrs['itemprop'] === 'image' && attrs['src']) image ??= attrs['src']
	}

	if (!title) return null

	return {
		title,
		imageUrl: image,
		ingredients,
		steps,
	}
}

// ===== OpenGraph =====

function fillFromOpenGraph(html: string, recipe: ImportedRecipe | null) {
	const title = metaContent(html, 'property', 'og:title')
	const image = metaContent(html, 'property', 'og:image')

	if (recipe)
		return {
			...recipe,
			imageUrl: recipe.imageUrl ?? image,
		}

	if (!title) return null

	return { title, imageUrl: image, ingredients: [], steps: [] }
}

// ===== Entry =====

function resolveImageUrl(
	value: string | undefined,
	baseUrl: string | undefined,
) {
	if (!value) return undefined

	try {
		return recipeImageUrl.safeParse(new URL(value, baseUrl).toString()).data
	} catch {
		return undefined
	}
}

export function parseRecipe(
	html: string,
	baseUrl?: string,
): ImportedRecipe | null {
	const recipe = fillFromOpenGraph(
		html,
		parseJsonLd(html) ?? parseMicrodata(html),
	)

	if (!recipe) return null

	if (recipe.ingredients.length === 0 && recipe.steps.length === 0) return null

	return {
		...recipe,
		ingredients: withHtmlIngredientGroups(
			html,
			recipe.ingredients.map(({ raw }) => raw),
		).map((raw) => ({ raw })),
		imageUrl: resolveImageUrl(recipe.imageUrl, baseUrl),
	}
}
