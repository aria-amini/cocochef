import { useNavigate } from '@tanstack/react-router'
import {
	createContext,
	lazy,
	Suspense,
	useContext,
	useMemo,
	useState,
} from 'react'

import { ImportDialog } from '@/components/import-link'
import type { StartingPoint } from '@/components/start-from'

type RecipeActions = {
	// Opens the one box, optionally already holding a query. Given `onUse`, it
	// finds a recipe to start one being written from, rather than to open.
	find: (query?: string, onUse?: (start: StartingPoint) => void) => void
	// Opens the import dialog, optionally holding a link.
	importLink: (url?: string) => void
	// Gets the box ready before it is asked for, so it opens at once.
	prepareFind: () => void
}

const RecipeActionsContext = createContext<RecipeActions | null>(null)

// The box only opens from the editor, so its code (the finder, and the reader
// it previews with) loads when the editor offers it, not with every page.
const loadFinder = () => import('@/components/recipe-finder')

const RecipeFinder = lazy(() =>
	loadFinder().then((module) => ({ default: module.RecipeFinder })),
)

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

	// Mounted, closed, once its code is here, and kept: it opens and closes
	// as it always has, and closing can play out.
	const [finderLoaded, setFinderLoaded] = useState(false)

	if (finder.open && !finderLoaded) setFinderLoaded(true)

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
			prepareFind: () => {
				void loadFinder().then(() => setFinderLoaded(true))
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
			{finderLoaded ? (
				<Suspense fallback={null}>
					<RecipeFinder
						open={finder.open}
						defaultQuery={finder.query}
						onUse={finder.onUse}
						onDismiss={dismiss}
						onLeave={dismiss}
					>
						{finder.open ? importDialog : null}
					</RecipeFinder>
				</Suspense>
			) : null}
			{finder.open ? null : importDialog}
		</RecipeActionsContext.Provider>
	)
}
