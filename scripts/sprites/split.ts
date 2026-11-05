// Cuts the generated sprite sheets (see PROMPT.md and manifest.json) into 32x32
// pantry sprites.
//
// A plain icon becomes <name>.png. An icon with a magenta tint key becomes two
// files in tint/: <name>.png holds the outline, lid and other fixed parts plus
// the shading over the tinted area (semi-transparent white and black), and
// <name>.fill.png is a mask of the tinted area. Stack the mask, painted any
// colour, under the shading to recolour it.
//
// Usage: vpx scripts/sprites/split.ts [sheets dir] [--preview file.png]
// The sheets dir defaults to ~/sprite-work/out.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { PNG } from 'pngjs'
import { z } from 'zod'

const SIZE = 32

// The largest icon fills this much of the canvas, like the existing sprites.
const FIT = 30

// The smallest icon is never drawn smaller than this, so a dropper next to a
// wine bottle stays readable.
const SMALLEST = 22

const manifest = z
	.object({
		sheets: z.array(
			z.object({
				output: z.string(),
				grid: z.object({ columns: z.number(), rows: z.number() }),
				cells: z.array(
					z.object({ name: z.string(), recolourable: z.boolean() }),
				),
			}),
		),
	})
	.parse(
		JSON.parse(
			await readFile(join(import.meta.dirname, 'manifest.json'), 'utf8'),
		),
	)

const args = process.argv.slice(2)

const previewAt = args.includes('--preview')
	? args[args.indexOf('--preview') + 1]
	: undefined

const sheetsDir = resolve(
	args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--preview') ??
		join(homedir(), 'sprite-work', 'out'),
)

const spritesDir = resolve(import.meta.dirname, '../../public/sprites/pantry')

type Rgb = [number, number, number]

// Shading levels of the tinted area, darkest to lightest: the deep and shade
// magentas, the base (which is the plain tint colour), and the light magenta.
const SHADE = [
	{ rgb: [0, 0, 0], alpha: 0.42 },
	{ rgb: [0, 0, 0], alpha: 0.22 },
	{ rgb: [0, 0, 0], alpha: 0 },
	{ rgb: [255, 255, 255], alpha: 0.4 },
] as const

// Mean brightness of the four key magentas (#5A005A, #A800A8, #FF00FF, #FF9AFF)
// halves the way between them.
const SHADE_STEPS = [86, 141, 196]

type Pixel =
	| { kind: 'frame'; rgb: Rgb }
	| { kind: 'tint'; shade: number }
	| undefined

type Sprite = Pixel[]

function hsv([r, g, b]: Rgb) {
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const d = max - min

	let h = 0

	if (d) {
		if (max === r) h = ((g - b) / d + 6) % 6
		else if (max === g) h = (b - r) / d + 2
		else h = (r - g) / d + 4
	}

	return { h: h * 60, s: max ? d / max : 0, v: max / 255 }
}

// The flat backdrop: close to white, however faint the generator's noise.
const isBackdrop = ([r, g, b]: Rgb) =>
	Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 30

// Magenta and its shades. Mauve and purple fall outside it.
const isTint = (rgb: Rgb) => {
	const { h, s, v } = hsv(rgb)

	return h >= 285 && h <= 335 && s >= 0.45 && v >= 0.25
}

function readPng(buffer: Buffer) {
	const png = PNG.sync.read(buffer)

	return { w: png.width, h: png.height, data: png.data }
}

function pngBuffer(pixels: number[][]) {
	const png = new PNG({ width: SIZE, height: SIZE })

	pixels.forEach((rgba, i) => {
		png.data.set(rgba, i * 4)
	})

	return PNG.sync.write(png)
}

type Cell = {
	w: number
	h: number
	// 0 backdrop, 1 fixed colours, 2 magenta
	kind: Uint8Array
	rgb: Rgb[]
}

function cutCell(
	sheet: ReturnType<typeof readPng>,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
): Cell {
	const w = x1 - x0
	const h = y1 - y0
	const rgb: Rgb[] = []

	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = ((y0 + y) * sheet.w + x0 + x) * 4

			rgb.push([
				sheet.data[i] ?? 0,
				sheet.data[i + 1] ?? 0,
				sheet.data[i + 2] ?? 0,
			])
		}

	// The backdrop is whatever light area reaches the cell's edge. Light parts
	// inside an icon sit behind its outline, so the fill never gets in.
	const kind = new Uint8Array(w * h).fill(1)
	const seen = new Uint8Array(w * h)
	const stack: number[] = []

	const push = (x: number, y: number) => {
		const i = y * w + x

		if (x < 0 || y < 0 || x >= w || y >= h || seen[i]) return

		seen[i] = 1

		if (isBackdrop(rgb[i] ?? [0, 0, 0])) stack.push(i)
	}

	for (let x = 0; x < w; x++) {
		push(x, 0)
		push(x, h - 1)
	}

	for (let y = 0; y < h; y++) {
		push(0, y)
		push(w - 1, y)
	}

	while (stack.length) {
		const i = stack.pop() ?? 0
		const x = i % w
		const y = (i - x) / w

		kind[i] = 0
		push(x + 1, y)
		push(x - 1, y)
		push(x, y + 1)
		push(x, y - 1)
	}

	for (let i = 0; i < kind.length; i++)
		if (kind[i] && isTint(rgb[i] ?? [0, 0, 0])) kind[i] = 2

	dropSpecks(kind, w, h)

	return { w, h, kind, rgb }
}

// Stray pixels the generator left around an icon are not part of it.
function dropSpecks(kind: Uint8Array, w: number, h: number) {
	const seen = new Uint8Array(w * h)

	for (let start = 0; start < kind.length; start++) {
		if (!kind[start] || seen[start]) continue

		const members = [start]

		seen[start] = 1

		for (let n = 0; n < members.length; n++) {
			const i = members[n] ?? 0
			const x = i % w
			const y = (i - x) / w

			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx
					const ny = y + dy
					const j = ny * w + nx

					if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue

					if (kind[j] && !seen[j]) {
						seen[j] = 1
						members.push(j)
					}
				}
		}

		if (members.length < 60) for (const i of members) kind[i] = 0
	}
}

function bounds(cell: Cell) {
	let x0 = cell.w
	let y0 = cell.h
	let x1 = -1
	let y1 = -1

	for (let y = 0; y < cell.h; y++)
		for (let x = 0; x < cell.w; x++)
			if (cell.kind[y * cell.w + x]) {
				x0 = Math.min(x0, x)
				x1 = Math.max(x1, x)
				y0 = Math.min(y0, y)
				y1 = Math.max(y1, y)
			}

	return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

const luma = ([r, g, b]: Rgb): number => 0.3 * r + 0.59 * g + 0.11 * b

const mean = (colors: Rgb[]): Rgb => {
	const sum = [0, 0, 0]

	for (const color of colors) {
		sum[0] = (sum[0] ?? 0) + color[0]
		sum[1] = (sum[1] ?? 0) + color[1]
		sum[2] = (sum[2] ?? 0) + color[2]
	}

	const n = colors.length || 1

	return [
		Math.round((sum[0] ?? 0) / n),
		Math.round((sum[1] ?? 0) / n),
		Math.round((sum[2] ?? 0) / n),
	]
}

// Shrinks one cell into a 32x32 sprite. The silhouette is where most of a block
// is icon, and its edge is redrawn from the darkest source pixels so the
// outline stays one crisp pixel.
function shrink(cell: Cell, scale: number): Sprite {
	const box = bounds(cell)
	const tw = Math.min(SIZE, Math.max(1, Math.round(box.w * scale)))
	const th = Math.min(SIZE, Math.max(1, Math.round(box.h * scale)))
	const ox = Math.floor((SIZE - tw) / 2)
	const oy = Math.floor((SIZE - th) / 2)

	type Block = { ink: Rgb[]; tint: Rgb[]; total: number }

	const blocks = new Map<number, Block>()

	for (let ty = 0; ty < th; ty++)
		for (let tx = 0; tx < tw; tx++) {
			const sx0 = box.x0 + Math.floor((tx * box.w) / tw)
			const sx1 = box.x0 + Math.max(Math.floor(((tx + 1) * box.w) / tw), 0)
			const sy0 = box.y0 + Math.floor((ty * box.h) / th)
			const sy1 = box.y0 + Math.max(Math.floor(((ty + 1) * box.h) / th), 0)
			const block: Block = { ink: [], tint: [], total: 0 }

			for (let y = sy0; y < Math.max(sy1, sy0 + 1); y++)
				for (let x = sx0; x < Math.max(sx1, sx0 + 1); x++) {
					const i = y * cell.w + x

					block.total++

					const color = cell.rgb[i] ?? [0, 0, 0]

					if (cell.kind[i] === 2) block.tint.push(color)
					else if (cell.kind[i] === 1) block.ink.push(color)
				}

			blocks.set((oy + ty) * SIZE + ox + tx, block)
		}

	const covered = (block: Block | undefined) =>
		block ? (block.ink.length + block.tint.length) / block.total >= 0.5 : false

	const sprite: Sprite = Array.from({ length: SIZE * SIZE })

	for (let y = 0; y < SIZE; y++)
		for (let x = 0; x < SIZE; x++) {
			const i = y * SIZE + x
			const block = blocks.get(i)

			if (!block || !covered(block)) continue

			const edge = [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1],
			].some(
				([nx = -1, ny = -1]) =>
					nx < 0 ||
					ny < 0 ||
					nx >= SIZE ||
					ny >= SIZE ||
					!covered(blocks.get(ny * SIZE + nx)),
			)

			if (edge) {
				const all = [...block.ink, ...block.tint].sort(
					(a, b) => luma(a) - luma(b),
				)

				sprite[i] = {
					kind: 'frame',
					rgb: mean(all.slice(0, Math.max(1, Math.ceil(all.length * 0.4)))),
				}
			} else if (block.tint.length >= block.ink.length) {
				const brightness = mean(block.tint).reduce((a, b) => a + b, 0) / 3

				sprite[i] = {
					kind: 'tint',
					shade: SHADE_STEPS.filter((step) => brightness >= step).length,
				}
			} else {
				sprite[i] = { kind: 'frame', rgb: mean(block.ink) }
			}
		}

	return sprite
}

// Median-cut palette, so each sprite keeps a handful of flat colours.
function quantize(sprite: Sprite, max = 16) {
	const colors: Rgb[] = sprite.flatMap((pixel) =>
		pixel?.kind === 'frame' ? [pixel.rgb] : [],
	)

	let boxes: Rgb[][] = [colors]

	while (boxes.length < max) {
		const target = boxes
			.filter((box) => box.length > 1)
			.sort((a, b) => b.length - a.length)[0]

		if (!target) break

		const channel =
			[...CHANNELS].sort((a, b) => spread(target, b) - spread(target, a))[0] ??
			0

		const sorted = [...target].sort((a, b) => a[channel] - b[channel])
		const half = Math.floor(sorted.length / 2)

		boxes = boxes
			.filter((box) => box !== target)
			.concat([sorted.slice(0, half), sorted.slice(half)])
	}

	const palette = boxes.filter((box) => box.length).map(mean)

	return sprite.map((pixel) => {
		if (pixel?.kind !== 'frame') return pixel

		const nearest = palette.reduce((best, color) =>
			distance(color, pixel.rgb) < distance(best, pixel.rgb) ? color : best,
		)

		return { kind: 'frame' as const, rgb: nearest }
	})
}

const CHANNELS: (0 | 1 | 2)[] = [0, 1, 2]

const spread = (colors: Rgb[], channel: 0 | 1 | 2) => {
	const values = colors.map((color) => color[channel])

	return Math.max(...values) - Math.min(...values)
}

const distance = (a: Rgb, b: Rgb) =>
	(a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

const clear = [0, 0, 0, 0]

// The fixed layer: outline, parts that do not change colour, and the shading
// laid over the tinted area.
function overlayPixels(sprite: Sprite) {
	return sprite.map((pixel) => {
		if (!pixel) return clear

		if (pixel.kind === 'frame') return [...pixel.rgb, 255]

		const shade = SHADE[pixel.shade] ?? SHADE[2]

		return [...shade.rgb, Math.round(shade.alpha * 255)]
	})
}

const fillPixels = (sprite: Sprite) =>
	sprite.map((pixel) => (pixel?.kind === 'tint' ? [255, 255, 255, 255] : clear))

// What the app will do: the fill in a colour, then the overlay over it.
function compose(sprite: Sprite, color: Rgb) {
	return sprite.map((pixel) => {
		if (!pixel) return clear

		if (pixel.kind === 'frame') return [...pixel.rgb, 255]

		const shade = SHADE[pixel.shade] ?? SHADE[2]

		return [
			...color.map((channel, i) =>
				Math.round(
					channel * (1 - shade.alpha) + (shade.rgb[i] ?? 0) * shade.alpha,
				),
			),
			255,
		]
	})
}

// The pepper mill is the picture for black pepper, under the name the app
// already uses.
const fileName = (name: string) =>
	name === 'pepper-mill' ? 'black-pepper' : name

const hex = (value: string): Rgb => [
	parseInt(value.slice(1, 3), 16),
	parseInt(value.slice(3, 5), 16),
	parseInt(value.slice(5, 7), 16),
]

await mkdir(join(spritesDir, 'tint'), { recursive: true })

const previews: { name: string; sprite: Sprite; tinted: boolean }[] = []

for (const sheetInfo of manifest.sheets) {
	const sheet = readPng(await readFile(join(sheetsDir, sheetInfo.output)))
	const { columns, rows } = sheetInfo.grid

	const cells = sheetInfo.cells.map((info, n) => {
		const col = n % columns
		const row = Math.floor(n / columns)

		return {
			info,
			cell: cutCell(
				sheet,
				Math.round((col * sheet.w) / columns),
				Math.round((row * sheet.h) / rows),
				Math.round(((col + 1) * sheet.w) / columns),
				Math.round(((row + 1) * sheet.h) / rows),
			),
		}
	})

	// One scale for the whole sheet keeps relative sizes (a dropper next to a
	// wine bottle), and no icon is drawn smaller than SMALLEST.
	const biggest = Math.max(
		...cells.map(({ cell }) => {
			const box = bounds(cell)

			return Math.max(box.w, box.h)
		}),
	)

	for (const { info, cell } of cells) {
		const box = bounds(cell)
		const own = Math.max(box.w, box.h)
		const scale = Math.min(FIT / own, Math.max(FIT / biggest, SMALLEST / own))
		const sprite = quantize(shrink(cell, scale))
		const tinted = sprite.some((pixel) => pixel?.kind === 'tint')
		const covered = sprite.filter(Boolean).length

		if (tinted !== info.recolourable)
			console.warn(
				`${info.name}: expected ${info.recolourable ? 'a' : 'no'} tint area, found ${tinted ? 'one' : 'none'}`,
			)

		if (covered < 150)
			console.warn(`${info.name}: only ${covered} pixels, check it`)

		if (tinted) {
			await writeFile(
				join(spritesDir, 'tint', `${info.name}.png`),
				pngBuffer(overlayPixels(sprite)),
			)
			await writeFile(
				join(spritesDir, 'tint', `${info.name}.fill.png`),
				pngBuffer(fillPixels(sprite)),
			)
		} else {
			await writeFile(
				join(spritesDir, `${fileName(info.name)}.png`),
				pngBuffer(overlayPixels(sprite)),
			)
		}

		previews.push({ name: info.name, sprite, tinted })
	}

	console.log(`${sheetInfo.output}: ${sheetInfo.cells.length} sprites`)
}

// The old flat spice mounds become jars under the same names, so every place
// that still uses those keys (stored pantry items, the spice fallback) shows a
// jar without any code change.
const bakes: [string, string, string][] = [
	['fallback-spice', 'shaker-jar', '#B5651D'],
	['salt', 'salt-shaker', '#F1F1EE'],
	['cinnamon', 'shaker-jar', '#9A5B30'],
	['mustard', 'mason-jar', '#D2A82A'],
]

for (const [name, from, color] of bakes) {
	const source = previews.find((preview) => preview.name === from)

	if (!source) throw new Error(`No ${from} sprite to bake ${name} from.`)

	await writeFile(
		join(spritesDir, `${name}.png`),
		pngBuffer(compose(source.sprite, hex(color))),
	)
}

if (previewAt) {
	// Every fixed sprite once, every tinted one in three colours, at 8x.
	const colors = [hex('#E3A21A'), hex('#E4EEF0'), hex('#7A1426')]

	const items = previews.flatMap(({ sprite, tinted }) =>
		tinted
			? colors.map((color) => compose(sprite, color))
			: [compose(sprite, colors[0] ?? [0, 0, 0])],
	)

	const scale = 8
	const columns = 12
	const cell = SIZE * scale + 8
	const rowsNeeded = Math.ceil(items.length / columns)
	const png = new PNG({ width: columns * cell, height: rowsNeeded * cell })

	png.data.fill(255)

	items.forEach((pixels, n) => {
		const left = (n % columns) * cell + 4
		const top = Math.floor(n / columns) * cell + 4

		pixels.forEach((rgba, i) => {
			if (!rgba[3]) return

			for (let dy = 0; dy < scale; dy++)
				for (let dx = 0; dx < scale; dx++) {
					const o =
						((top + Math.floor(i / SIZE) * scale + dy) * png.width +
							left +
							(i % SIZE) * scale +
							dx) *
						4

					png.data.set(rgba, o)
				}
		})
	})

	await writeFile(resolve(previewAt), PNG.sync.write(png))
	console.log(`Preview written to ${resolve(previewAt)}`)
}

console.log(`Sprites written to ${spritesDir}`)
