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
