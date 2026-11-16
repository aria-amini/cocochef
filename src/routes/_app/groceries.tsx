import { createFileRoute } from '@tanstack/react-router'

import {
	KitchenPage,
	KitchenPending,
	kitchenSearch,
	loadKitchen,
} from '@/components/kitchen-page'
import { useKeptMatch } from '@/lib/kept-match'

// The grocery list: what the kitchen needs, by aisle, ticked off in the shop.
export const Route = createFileRoute('/_app/groceries')({
	// Adding floats above the tab bar on phones, as on the shelf.
	staticData: { tabBar: 'own-fab' },
	validateSearch: kitchenSearch,
	loader: loadKitchen,
	head: () => ({ meta: [{ title: 'groceries · cocochef' }] }),
	pendingComponent: GroceriesPending,
	component: GroceriesPage,
})

function GroceriesPending() {
	return <KitchenPending view="groceries" />
}

function GroceriesPage() {
	const { loaderData, search } = useKeptMatch(Route.id)

	return <KitchenPage view="groceries" loaded={loaderData} search={search} />
}
