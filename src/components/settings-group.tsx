import { useId } from 'react'

import { cn } from '@/lib/utils/ui'

// One row of a settings card: tall enough for a thumb, the same padding in
// every group.
export const settingsRowClassName =
	'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left'

// A row that is itself the action: the whole row presses.
export const settingsActionClassName = cn(
	settingsRowClassName,
	'hover:bg-kitchen-yolk/20 cursor-pointer text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
)

// Settings come in quiet groups: a small name, one paper card of rows, and at
// most one line under it saying what the group means. Explanation stays out
// of the rows.
export function SettingsGroup({
	id,
	title,
	hint,
	children,
}: {
	id?: string
	title?: string
	hint?: React.ReactNode
	children: React.ReactNode
}) {
	const titleId = useId()

	return (
		<section
			id={id}
			aria-labelledby={title ? titleId : undefined}
			className="flex scroll-mt-6 flex-col gap-2"
		>
			{title ? (
				<h2 id={titleId} className="px-1 text-sm font-bold">
					{title}
				</h2>
			) : null}
			<div className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
				{children}
			</div>
			{hint ? (
				<p className="text-muted-foreground px-1 text-sm">{hint}</p>
			) : null}
		</section>
	)
}
