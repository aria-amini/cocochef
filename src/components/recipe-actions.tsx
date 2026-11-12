import { useNavigate } from '@tanstack/react-router'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { ImportDialog, linkFrom } from '@/components/import-link'
import { PasteRecipeDialog } from '@/components/paste-recipe-dialog'
import { RecipeFinder } from '@/components/recipe-finder'
import type { StartingPoint } from '@/components/start-from'

type RecipeActions = {
	// Opens the one box, optionally already holding a query. Given `onUse`, it
	// finds a recipe to start one being written from, rather than to open.
	find: (query?: string, onUse?: (start: StartingPoint) => void) => void
	// Opens the import dialog, optionally holding a link.
	importLink: (url?: string) => void
	// Opens a box to paste a whole recipe's text into.
	pasteText: () => void
}

const RecipeActionsContext = createContext<RecipeActions | null>(null)

export function useRecipeActions() {
	const actions = useContext(RecipeActionsContext)

	if (!actions)
		throw new Error('useRecipeActions needs a RecipeActionsProvider above it')

	return actions
}

// One box and one import dialog for every page, so the search, the buttons,
// the phone's round button and ⌘K all open the same thing.
export function RecipeActionsProvider({
	children,
}: {
	children: React.ReactNode
}) {
	const [finder, setFinder] = useState<{
		open: boolean
		query: string
		onUse?: ((start: StartingPoint) => void) | undefined
	}>({ open: false, query: '' })

	const [importing, setImporting] = useState<{
		open: boolean
		url?: string | undefined
	}>({
		open: false,
	})

	const [pasting, setPasting] = useState(false)
	const navigate = useNavigate()

	const actions = useMemo<RecipeActions>(
		() => ({
			find: (query = '', onUse) => setFinder({ open: true, query, onUse }),
			importLink: (url) => {
				setImporting({ open: true, url })
			},
			pasteText: () => setPasting(true),
		}),
		[],
	)

	useEffect(() => {
		function toggle(event: KeyboardEvent) {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
				return
			event.preventDefault()
			setFinder((current) => ({ open: !current.open, query: '' }))
		}

		window.addEventListener('keydown', toggle)

		return () => window.removeEventListener('keydown', toggle)
	}, [])

	const importDialog = (
		<ImportDialog
			open={importing.open}
			defaultValue={importing.url}
			onOpenChange={(open) => setImporting((current) => ({ ...current, open }))}
			onImported={() => setFinder((current) => ({ ...current, open: false }))}
		/>
	)

	return (
		<RecipeActionsContext.Provider value={actions}>
			{children}
			<RecipeFinder
				open={finder.open}
				defaultQuery={finder.query}
				onUse={finder.onUse}
				onOpenChange={(open) => setFinder((current) => ({ ...current, open }))}
			>
				{finder.open ? importDialog : null}
			</RecipeFinder>
			{finder.open ? null : importDialog}
			{/* A pasted link is imported; pasted text becomes a new recipe. */}
			<PasteRecipeDialog
				open={pasting}
				onOpenChange={setPasting}
				onAdd={(text) => {
					const link = linkFrom(text)

					if (link) actions.importLink(link)
					else void navigate({ to: '/recipes/new', state: { pasted: text } })
				}}
			/>
		</RecipeActionsContext.Provider>
	)
}
