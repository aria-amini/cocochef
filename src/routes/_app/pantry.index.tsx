import { createFileRoute } from '@tanstack/react-router'

import {
	KitchenPage,
	KitchenPending,
	kitchenSearch,
	loadKitchen,
} from '@/components/kitchen-page'
import { useKeptMatch } from '@/lib/kept-match'

// What the kitchen has: what to use first, what came in last, and each spot.
export const Route = createFileRoute('/_app/pantry/')({
	// Adding floats above the tab bar on phones, as on the shelf.
	staticData: { tabBar: 'own-fab' },
	validateSearch: kitchenSearch,
	loader: loadKitchen,
	head: () => ({ meta: [{ title: 'pantry · cocochef' }] }),
	pendingComponent: PantryPending,
	component: PantryPage,
})

function PantryPending() {
	return <KitchenPending view="pantry" />
}

function PantryPage() {
	const { loaderData, search } = useKeptMatch(Route.id)

	return <KitchenPage view="pantry" loaded={loaderData} search={search} />
}
