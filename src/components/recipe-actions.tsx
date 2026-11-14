import { useNavigate } from '@tanstack/react-router'
import { createContext, useContext, useMemo, useState } from 'react'

import { ImportDialog } from '@/components/import-link'
import { RecipeFinder } from '@/components/recipe-finder'
import type { StartingPoint } from '@/components/start-from'

type RecipeActions = {
	// Opens the one box, optionally already holding a query. Given `onUse`, it
	// finds a recipe to start one being written from, rather than to open.
	find: (query?: string, onUse?: (start: StartingPoint) => void) => void
	// Opens the import dialog, optionally holding a link.
	importLink: (url?: string) => void
}

const RecipeActionsContext = createContext<RecipeActions | null>(null)

export function useRecipeActions() {
	const actions = useContext(RecipeActionsContext)

	if (!actions)
		throw new Error('useRecipeActions needs a RecipeActionsProvider above it')

	return actions
}

// One box and one import dialog for every page: the box picks a recipe to
// start a new one from.
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

	const navigate = useNavigate()

	const actions = useMemo<RecipeActions>(
		() => ({
			// Searching is home's: a search asked for anywhere goes there. Picking
			// a recipe to start one from is a moment in the editor, not a place
			// to come back to, so it opens over the editor and keeps no history.
			find: (query = '', onUse) =>
				onUse
					? setFinder({ open: true, query, onUse })
					: void navigate({ to: '/', search: { q: query } }),
			importLink: (url) => {
				setImporting({ open: true, url })
			},
		}),
		[navigate],
	)

	const dismiss = () => setFinder((current) => ({ ...current, open: false }))

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
				onDismiss={dismiss}
				onLeave={dismiss}
			>
				{finder.open ? importDialog : null}
			</RecipeFinder>
			{finder.open ? null : importDialog}
		</RecipeActionsContext.Provider>
	)
}
