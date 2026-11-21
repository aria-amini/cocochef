import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getAccountId } from '@/lib/auth/session'

import { pantryBrand } from './model'

// A trial: the front of the package for a branded food, from Open Food
// Facts, so "soy sauce · kikkoman" can show the bottle. A photo is used only
// when the product's brand is the cook's and its name holds the food's
// words; anything less shows the food's own picture.
const searchUrl = 'https://search.openfoodfacts.org/search'

type Hit = {
	product_name?: string | null
	brands?: string[] | string | null
	image_front_small_url?: string | null
	countries_tags?: string[] | null
}

const words = (text: string) =>
	text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		// One word whatever its number: "beans" is "bean".
		.map((word) => word.replace(/(?:es|s)$/, ''))

const holds = (text: string, wanted: string[]) => {
	const have = new Set(words(text))

	return wanted.every((word) => have.has(word))
}

function pick(hits: Hit[], food: string, brand: string) {
	const foodWords = words(food)
	const brandWords = words(brand)

	const fits = hits.filter((hit) => {
		const brands = [hit.brands ?? []].flat().join(' ')

		return (
			!!hit.image_front_small_url &&
			holds(hit.product_name ?? '', foodWords) &&
			holds(`${brands} ${hit.product_name ?? ''}`, brandWords)
		)
	})

	const american = fits.find((hit) =>
		hit.countries_tags?.includes('en:united-states'),
	)

	return (american ?? fits[0])?.image_front_small_url ?? null
}

// Found once per food and brand while the server runs; a trial needs no more.
// What's been looked up, newest last. Only so many are kept, and only
// answers: a lookup that failed is asked again next time.
const found = new Map<string, string | null>()

const remembered = 500

function remember(key: string, photo: string | null) {
	found.delete(key)
	found.set(key, photo)

	const oldest = found.size > remembered ? found.keys().next().value : undefined

	if (oldest !== undefined) found.delete(oldest)
}

async function lookUp(food: string, brand: string) {
	const query = new URLSearchParams({
		q: `${brand} ${food}`,
		page_size: '20',
		fields: 'product_name,brands,image_front_small_url,countries_tags',
	})

	try {
		const response = await fetch(`${searchUrl}?${query}`, {
			headers: { 'User-Agent': 'cocochef/0.1 (https://cocochef.app)' },
			signal: AbortSignal.timeout(6000),
		})

		// Failed, it's not known: undefined, so it isn't remembered.
		if (!response.ok) return undefined

		const body: { hits?: Hit[] } = await response.json()

		return pick(body.hits ?? [], food, brand)
	} catch {
		return undefined
	}
}

export const productPhoto = createServerFn({ method: 'GET' })
	.validator(
		z.object({
			food: z.string().trim().min(1).max(200),
			brand: pantryBrand.pipe(z.string()),
		}),
	)
	.handler(async ({ data }) => {
		// Only for a cook's own pantry: not a lookup anyone can run.
		if (!(await getAccountId())) return null

		const key = `${data.food.toLowerCase()}|${data.brand.toLowerCase()}`
		const kept = found.get(key)

		if (kept !== undefined) return kept

		const photo = await lookUp(data.food, data.brand)

		if (photo !== undefined) remember(key, photo)

		return photo ?? null
	})
