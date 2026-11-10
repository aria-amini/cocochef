// A list the cook arranges is made of blocks: a head row and the rows that
// belong under it, such as a section heading and its ingredients, or a step
// and its sub-steps. Rows before the first head belong to no block's head.
export type Block<T> = { head: T | undefined; rows: T[] }

export function blocksOf<T>(
	rows: readonly T[],
	isHead: (row: T, index: number) => boolean,
): Block<T>[] {
	const blocks: Block<T>[] = []

	rows.forEach((row, index) => {
		const last = blocks.at(-1)

		if (isHead(row, index)) blocks.push({ head: row, rows: [] })
		else if (last) last.rows.push(row)
		else blocks.push({ head: undefined, rows: [row] })
	})

	return blocks
}

export function flattenBlocks<T>(blocks: readonly Block<T>[]): T[] {
	return blocks.flatMap((block) =>
		block.head === undefined ? block.rows : [block.head, ...block.rows],
	)
}

// Moves a head and everything under it to where another head stands. Rows with
// no head stay first, since nothing can be put above them without taking them
// in.
export function moveBlock<T>(
	rows: readonly T[],
	isHead: (row: T, index: number) => boolean,
	from: T,
	to: T,
): T[] {
	const blocks = blocksOf(rows, isHead)
	const start = blocks.findIndex((block) => block.head === from)
	const end = blocks.findIndex((block) => block.head === to)
	const moving = blocks[start]

	if (start < 0 || end < 0 || start === end || !moving) return [...rows]

	const rest = blocks.filter((_, index) => index !== start)
	rest.splice(end, 0, moving)

	return flattenBlocks(rest)
}

// Gathers the picked rows under a new head, in their order. The new block goes
// right after the block the first picked row came from, so no block it passes
// is split, and rows without a head stay first.
export function gatherBlock<T>(
	rows: readonly T[],
	isHead: (row: T, index: number) => boolean,
	picked: ReadonlySet<T>,
	head: T,
): T[] {
	const gathered = rows.filter(
		(row, index) => picked.has(row) && !isHead(row, index),
	)

	const [first] = gathered

	if (first === undefined) return [...rows]

	const owner = rows
		.slice(0, rows.indexOf(first))
		.filter((row, index) => isHead(row, index))
		.at(-1)

	const blocks = blocksOf(
		rows.filter((row) => !gathered.includes(row)),
		isHead,
	)

	const after = blocks.findIndex((block) => block.head === owner)
	// A loose first row's block may be gone, with all its rows gathered.
	const at = after < 0 ? 0 : after + 1
	blocks.splice(at, 0, { head, rows: gathered })

	return flattenBlocks(blocks)
}
