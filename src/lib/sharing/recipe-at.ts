// What a readable address shows. Anyone the app already knows gets the recipe
// in the app, with the sidebar, cooking and saving; visitors with no session
// (readers, crawlers, link previews) get the plain page. A cook's own recipe
// that is not published still opens for them at its address. Missing and
// private recipes look the same: nothing.
export async function recipeAt<Published extends { id: string }, Full>({
	published,
	signedIn,
	ownedId,
	full,
}: {
	published: Published | null
	signedIn: boolean
	// The signed-in cook's own recipe at this address, if any.
	ownedId: () => Promise<string | null>
	full: (id: string) => Promise<Full | null>
}) {
	if (!published) {
		if (!signedIn) return null

		const id = await ownedId()
		const recipe = id ? await full(id) : null

		return recipe ? { kind: 'app' as const, recipe } : null
	}

	if (signedIn) {
		const recipe = await full(published.id)

		if (recipe) return { kind: 'app' as const, recipe }
	}

	return { kind: 'public' as const, recipe: published }
}
