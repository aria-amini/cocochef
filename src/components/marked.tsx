// Wraps each search word in a mark, wherever it appears in a line.
export function Marked({ text, terms }: { text: string; terms: string[] }) {
	if (terms.length === 0) return text

	const pattern = new RegExp(
		`(${terms.map((term) => term.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
		'gi',
	)

	return text.split(pattern).map((part, index) =>
		index % 2 === 1 ? (
			<mark
				// Parts repeat; their place in the line is what tells them apart.
				// oxlint-disable-next-line react/no-array-index-key
				key={index}
				className="bg-kitchen-yolk/45 text-foreground rounded-sm px-0.5"
			>
				{part}
			</mark>
		) : (
			part
		),
	)
}
