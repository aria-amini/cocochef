import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog'
import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { cn } from '@/lib/utils/ui'

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
				<DialogTitle>paste a recipe</DialogTitle>
				<DialogDescription>
					paste the recipe below and we’ll sort its ingredients and steps.
				</DialogDescription>
				<textarea
					aria-label="recipe text"
					value={text}
					onChange={(event) => setText(event.target.value)}
					rows={9}
					placeholder="paste your recipe here"
					className={cn(
						fieldClassName,
						placeholderClassName,
						'resize-y text-sm',
					)}
				/>
				<div className="flex justify-end gap-3">
					<button
						type="button"
						className={buttonVariants({ variant: 'outline' })}
						onClick={() => changeOpen(false)}
					>
						cancel
					</button>
					<button
						type="button"
						disabled={!text.trim()}
						className={buttonVariants()}
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
