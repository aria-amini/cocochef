import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { ImportDialog } from '@/components/import-link'
import { RecipeFinder } from '@/components/recipe-finder'

type RecipeActions = {
	// Opens the one box, optionally already holding a query.
	find: (query?: string) => void
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

// One box and one import dialog for every page, so the search, the buttons,
// the phone's round button and ⌘K all open the same thing.
export function RecipeActionsProvider({
	children,
}: {
	children: React.ReactNode
}) {
	const [finder, setFinder] = useState({ open: false, query: '' })

	const [importing, setImporting] = useState<{
		open: boolean
		url?: string | undefined
	}>({
		open: false,
	})

	const actions = useMemo<RecipeActions>(
		() => ({
			find: (query = '') => setFinder({ open: true, query }),
			importLink: (url) => {
				setImporting({ open: true, url })
			},
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
				onOpenChange={(open) => setFinder((current) => ({ ...current, open }))}
				onImportLink={actions.importLink}
			>
				{finder.open ? importDialog : null}
			</RecipeFinder>
			{finder.open ? null : importDialog}
		</RecipeActionsContext.Provider>
	)
}
