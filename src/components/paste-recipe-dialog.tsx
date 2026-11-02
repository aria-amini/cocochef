import { useState } from 'react'

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog'

export function PasteRecipeDialog({
	open,
	onOpenChange,
	onAdd,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	onAdd: (text: string) => void
}) {
	const [text, setText] = useState('')

	const changeOpen = (next: boolean) => {
		if (!next) setText('')
		onOpenChange(next)
	}

	return (
		<Dialog open={open} onOpenChange={changeOpen}>
			<DialogContent>
				<DialogTitle>Paste a recipe</DialogTitle>
				<DialogDescription>
					Paste the recipe below and we’ll sort its ingredients and steps.
				</DialogDescription>
				<textarea
					aria-label="recipe text"
					value={text}
					onChange={(event) => setText(event.target.value)}
					rows={9}
					placeholder="Paste your recipe here"
					className="border-input bg-background focus-visible:outline-kitchen-eggplant w-full resize-y rounded-md border p-3 text-sm focus-visible:outline-2"
				/>
				<div className="flex justify-end gap-3">
					<button
						type="button"
						className="rounded-md border px-3 py-2 text-sm"
						onClick={() => changeOpen(false)}
					>
						cancel
					</button>
					<button
						type="button"
						disabled={!text.trim()}
						className="bg-kitchen-basil rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
						onClick={() => {
							onAdd(text)
							changeOpen(false)
						}}
					>
						add recipe
					</button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
