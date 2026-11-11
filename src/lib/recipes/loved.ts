// How loved a recipe is: its stars, pulled toward an ordinary 4 until enough
// people have rated it, so five stars from two readers does not beat 4.8
// from five hundred. Comments add a little; an unrated recipe scores nothing.
export function lovedScore(
	rating: { value: number; count: number } | undefined,
	comments = 0,
) {
	const stars = rating?.count
		? (rating.value * rating.count + 4 * 20) / (rating.count + 20)
		: 0

	return stars + Math.log10(1 + comments) / 10
}

// The most loved first; equals keep their order.
export function byLoved<T>(
	items: readonly T[],
	score: (item: T) => number,
): T[] {
	return items
		.map((item, at) => ({ item, at, score: score(item) }))
		.sort((a, b) => b.score - a.score || a.at - b.at)
		.map(({ item }) => item)
}
