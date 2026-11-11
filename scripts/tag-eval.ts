import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Tags a sample of recipes with TypeSafe's Jev classifier and compares them
// with the tags the title words give, to judge Jev before storing its tags.
// Writes a JSON report and an HTML page side by side.
//
//   varlock run -- vpx tsx scripts/tag-eval.ts <out-dir> [catalogSample=74]
import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk'
import pg from 'pg'

import {
	cuisineParts,
	formParts,
	mealTags,
	proteinParts,
} from '../src/lib/assistant/meal-parts'
import catalog from '../src/lib/discover/catalog.json'

const [outDir = '.', sampleArg = '74'] = process.argv.slice(2)

const model = 'jev-1.13.0'

const threshold = 0.5

// `key` is the meal_tags key: the page, or `recipe:<id>` for a recipe with none.
type Sample = {
	key: string
	title: string
	ingredients: string[]
	from: string
}

const labels = (names: string[], extra: Record<string, string>) => ({
	...Object.fromEntries(names.map((name) => [name, null])),
	...extra,
})

const flavorNames = cuisineParts.flatMap((cuisine) =>
	cuisine.flavors.map((flavor) => flavor.name),
)

const questions = {
	meal: noul(
		'Is this a savory dish someone would cook as a main or side for a meal? Desserts, baked sweets, drinks, sauces, dressings and spice mixes are not.',
	),
	cuisine: choice('Which cuisine is this dish from?', {
		...labels(
			cuisineParts.map((cuisine) => cuisine.name),
			{},
		),
		'american south': 'Cajun, Creole, Southern, Tex-Mex, barbecue',
		other: 'Another cuisine, or no clear cuisine (plain American, fusion)',
	}),
	flavor: choice(
		'Which of these flavors or styles defines the dish? Pick none unless one clearly does.',
		labels(flavorNames, { none: 'None of these defines it' }),
	),
	protein: choice('What is the main protein?', {
		...labels(
			proteinParts.map((protein) => protein.name),
			{},
		),
		'white fish': 'Cod, halibut, tilapia, haddock and other mild white fish',
		'beans & lentils': 'Beans, lentils or chickpeas as the main protein',
		none: 'No main protein: vegetables, grains or cheese carry it',
		other: 'Another protein not listed (sausage counts as pork)',
	}),
	...Object.fromEntries(
		formParts.map((form) => [
			`form:${form.name}`,
			noul(`Is this dish a ${form.name}, or served as one?`),
		]),
	),
}

async function samples(): Promise<Sample[]> {
	const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
	await client.connect()

	const { rows } = await client.query<{
		key: string
		title: string
		ingredients: string[]
	}>(`select coalesce(r.source_url, 'recipe:' || r.id) as key, r.title, coalesce(array_agg(i.text order by i.position) filter (where i.text is not null), '{}') as ingredients
		from recipes r left join recipe_ingredients i on i.recipe_id = r.id
		group by r.id order by r.title`)

	await client.end()

	// A fixed spread through the catalog, so reruns compare the same pages.
	const links: { url: string; title: string }[] = catalog
	const count = Number(sampleArg)
	const step = Math.floor(links.length / count)

	const picked =
		links.length <= count
			? links
			: Array.from({ length: count }, (_, i) => links[i * step + 7]!)

	return [
		...rows.map((row) => ({ ...row, from: 'read page' })),
		...picked.map((link) => ({
			key: link.url,
			title: link.title,
			ingredients: [],
			from: 'title only',
		})),
	]
}

const client = new TypeSafeClient()

async function tag(sample: Sample) {
	const state = sample.ingredients.length
		? { recipe: sample.title, ingredients: sample.ingredients }
		: { recipe: sample.title }

	const started = performance.now()

	const { answers: typed, usage } = await client.systemOne({
		state,
		questions,
		model,
	})

	const answers: Record<
		string,
		(typeof typed)[keyof typeof typed] | undefined
	> = typed

	const ms = Math.round(performance.now() - started)

	const forms = formParts.flatMap((form) => {
		const answer = answers[`form:${form.name}`]
		const p = answer && 'noul' in answer ? answer.noul : 0

		return p >= threshold ? [{ name: form.name, p }] : []
	})

	const pick = (answer: { choice: string; confidence: number }) => ({
		name: answer.choice,
		p: answer.confidence,
	})

	return {
		...sample,
		ms,
		usage,
		jev: {
			meal: typed.meal.noul,
			cuisine: pick(typed.cuisine),
			flavor: pick(typed.flavor),
			protein: pick(typed.protein),
			forms,
		},
		words: mealTags(sample.title) ?? null,
	}
}

async function pool<T, R>(
	items: T[],
	size: number,
	run: (item: T) => Promise<R>,
) {
	const results: R[] = []
	let next = 0
	await Promise.all(
		Array.from({ length: size }, async () => {
			while (next < items.length) {
				const index = next++
				results[index] = await run(items[index]!)
			}
		}),
	)

	return results
}

const all = await samples()

console.log(`tagging ${all.length} recipes with ${model}…`)

const results = await pool(all, 5, async (sample) => {
	try {
		return await tag(sample)
	} catch (error) {
		console.error(`failed: ${sample.title}: ${String(error)}`)

		return undefined
	}
})

const done = results.filter((result) => result !== undefined)

const tokens = done.reduce((sum, r) => sum + (r.usage?.input_tokens ?? 0), 0)

const ms = done.map((r) => r.ms).sort((a, b) => a - b)

const summary = {
	model,
	recipes: done.length,
	failed: results.length - done.length,
	inputTokens: tokens,
	tokensPerRecipe: Math.round(tokens / done.length),
	medianMs: ms[Math.floor(ms.length / 2)],
	p90Ms: ms[Math.floor(ms.length * 0.9)],
}

console.log(summary)

// Saved as the parts the finder offers: a confident pick, and a flavor names
// its cuisine too, as the title words do.
const confident = (pick: { name: string; p: number }, skip: string[]) =>
	pick.p >= threshold && !skip.includes(pick.name) ? [pick.name] : []

const cuisineOf = (flavor: string) =>
	cuisineParts.find((cuisine) =>
		cuisine.flavors.some((part) => part.name === flavor),
	)?.name

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })

await db.connect()

const keys = new Set<string>()

for (const r of done) {
	if (keys.has(r.key)) continue
	keys.add(r.key)
	const meal = r.jev.meal >= threshold
	const flavors = meal ? confident(r.jev.flavor, ['none']) : []

	const cuisines = meal
		? [
				...new Set([
					...confident(r.jev.cuisine, ['other']),
					...flavors.flatMap((flavor) => cuisineOf(flavor) ?? []),
				]),
			]
		: []

	await db.query(
		`insert into meal_tags (key, meal, cuisines, flavors, proteins, forms, model, tagged_at)
		values ($1, $2, $3, $4, $5, $6, $7, now())
		on conflict (key) do update set meal = excluded.meal, cuisines = excluded.cuisines,
		flavors = excluded.flavors, proteins = excluded.proteins, forms = excluded.forms,
		model = excluded.model, tagged_at = excluded.tagged_at`,
		[
			r.key,
			meal,
			cuisines,
			flavors,
			meal ? confident(r.jev.protein, ['none', 'other']) : [],
			meal ? r.jev.forms.map((form) => form.name) : [],
			model,
		],
	)
}

await db.end()

console.log(`saved tags for ${keys.size} recipes`)

await writeFile(
	join(outDir, 'tags.json'),
	JSON.stringify({ summary, done }, null, 2),
)

const esc = (text: string) =>
	text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const chip = (name: string, p: number, kind: string) =>
	`<span class="chip ${kind} ${p < 0.6 ? 'low' : ''}" title="${p.toFixed(2)}">${esc(name)} <small>${Math.round(p * 100)}</small></span>`

const wordChips = (words: string[]) =>
	words.map((w) => `<span class="chip words">${esc(w)}</span>`).join('')

const rows = done
	.map((r) => {
		const j = r.jev

		const jevChips = [
			j.cuisine.name !== 'other'
				? chip(j.cuisine.name, j.cuisine.p, 'cuisine')
				: '',
			j.flavor.name !== 'none' ? chip(j.flavor.name, j.flavor.p, 'flavor') : '',
			!['none', 'other'].includes(j.protein.name)
				? chip(j.protein.name, j.protein.p, 'protein')
				: '',
			...j.forms.map((f) => chip(f.name, f.p, 'form')),
		].join('')

		const w = r.words

		const wordTags = w
			? wordChips([...w.cuisines, ...w.flavors, ...w.proteins, ...w.forms])
			: '<span class="muted">not a meal</span>'

		return `<tr class="${j.meal < threshold ? 'notmeal' : ''}">
<td><b>${esc(r.title)}</b><div class="muted">${r.from}${r.ingredients.length ? ` · ${r.ingredients.length} ingredients` : ''}</div></td>
<td>${j.meal < threshold ? `<span class="muted">not a meal (${Math.round(j.meal * 100)})</span> ` : ''}${jevChips || '<span class="muted">—</span>'}</td>
<td>${wordTags || '<span class="muted">—</span>'}</td></tr>`
	})
	.join('\n')

const covered = (pred: (r: (typeof done)[number]) => boolean) =>
	done.filter(pred).length

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jev Recipe Tags</title><style>
:root{--bg:#fbf8f3;--fg:#2b2620;--muted:#7a7066;--line:#e6dfd5;--cuisine:#f3d9b1;--flavor:#f6c7c0;--protein:#cfe3c4;--form:#cbdcef;--words:#ece6dd}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1d1a17;--fg:#eee6db;--muted:#9a9086;--line:#3a342e;--cuisine:#5a4527;--flavor:#5c3530;--protein:#34492b;--form:#2c4057;--words:#36302a}}
body{background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;margin:0;padding:16px}
h1{font-size:20px;margin:0 0 4px}.muted{color:var(--muted);font-size:12px}
.stats{display:flex;flex-wrap:wrap;gap:8px 20px;margin:12px 0 16px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:8px 6px;vertical-align:top;text-align:left}
th{font-size:12px;color:var(--muted);font-weight:600}
.chip{display:inline-block;border-radius:999px;padding:1px 8px;margin:2px 4px 2px 0;font-size:12.5px}
.chip small{opacity:.6}.cuisine{background:var(--cuisine)}.flavor{background:var(--flavor)}.protein{background:var(--protein)}.form{background:var(--form)}.words{background:var(--words)}
.low{opacity:.55;outline:1px dashed var(--muted)}tr.notmeal td{opacity:.6}
@media (max-width:640px){td:first-child{min-width:9rem}}
</style></head><body>
<h1>Jev recipe tags vs. title words</h1>
<div class="muted">${model} · ${done.length} recipes · numbers are Jev's confidence (%) · dashed = under 60</div>
<div class="stats">
<span><b>${covered((r) => r.jev.cuisine.name !== 'other')}</b> cuisine (Jev) vs <b>${covered((r) => Boolean(r.words?.cuisines.length))}</b> (words)</span>
<span><b>${covered((r) => !['none', 'other'].includes(r.jev.protein.name))}</b> protein vs <b>${covered((r) => Boolean(r.words?.proteins.length))}</b></span>
<span><b>${covered((r) => r.jev.forms.length > 0)}</b> kind of dish vs <b>${covered((r) => Boolean(r.words?.forms.length))}</b></span>
<span>${summary.tokensPerRecipe} tokens/recipe · median ${summary.medianMs} ms</span>
</div>
<table><thead><tr><th>recipe</th><th>Jev</th><th>title words</th></tr></thead><tbody>
${rows}
</tbody></table></body></html>`

await writeFile(join(outDir, 'tags.html'), html)

console.log(`wrote ${join(outDir, 'tags.html')}`)
