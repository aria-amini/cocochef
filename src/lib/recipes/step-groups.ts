// Steps are a flat list of lines. A line that starts with "- " is a sub-step of
// the nearest line above it that doesn't, the same way "## " marks a heading in
// the ingredients: no new column, and an export still reads naturally.
const SUB_STEP = /^-\s+(\S.*)$/

export function isSubStep(line: string) {
	return SUB_STEP.test(line.trim())
}

export function formatSubStep(text: string) {
	const trimmed = text.trim()

	return trimmed ? `- ${trimmed}` : ''
}

export type StepRow =
	| { kind: 'step'; text: string; index: number; label: string }
	| {
			kind: 'group'
			text: string
			index: number
			label: string
			children: { text: string; index: number; label: string }[]
	  }

// The steps as the cook reads them: a line with sub-steps becomes a group (a
// label with no box of its own), the rest are single steps. Every row keeps its
// index in the stored list, which is what cooking progress points at. A
// sub-step with no plain line above it is just a step.
export function stepRows(steps: string[]): StepRow[] {
	const rows: StepRow[] = []
	let number = 0

	for (const [index, line] of steps.entries()) {
		const sub = SUB_STEP.exec(line.trim())?.[1]
		const parent = rows.at(-1)

		// Only a plain line can be a parent; a run of "- " lines at the start is
		// just steps.
		if (sub !== undefined && parent && !isSubStep(steps[parent.index] ?? '')) {
			if (parent.kind === 'step')
				rows[rows.length - 1] = {
					kind: 'group',
					text: parent.text,
					index: parent.index,
					label: parent.label,
					children: [],
				}

			const group = rows.at(-1)

			if (group?.kind === 'group')
				group.children.push({
					text: sub,
					index,
					label: `${group.label}.${group.children.length + 1}`,
				})

			continue
		}

		number += 1
		rows.push({
			kind: 'step',
			text: sub ?? line,
			index,
			label: String(number),
		})
	}

	return rows
}

// The indexes a cook can tick off: every step that is not a group's label.
export function checkableStepIndexes(steps: string[]) {
	return stepRows(steps).flatMap((row) =>
		row.kind === 'group'
			? row.children.map((child) => child.index)
			: [row.index],
	)
}

// Each stored step's number as the cook reads it: "3", or "3.2" for a sub-step.
export function stepLabels(steps: string[]) {
	const labels: string[] = []

	for (const row of stepRows(steps)) {
		labels[row.index] = row.label

		if (row.kind === 'group')
			for (const child of row.children) labels[child.index] = child.label
	}

	return labels
}
