import { BookmarkSimpleIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { DeleteRecipeDialog } from '@/components/delete-recipe-dialog'
import { Button } from '@/components/ui/button'
import { rememberAfterSignIn, takeAfterSignIn } from '@/lib/auth/after-sign-in'
import { authClient } from '@/lib/auth/client'
import { getRecipe, removeSavedRecipe, saveRecipe } from '@/lib/recipes/server'

export function SaveRecipeButton({
	recipe,
	onAuthenticated,
}: {
	onAuthenticated?: () => void
	recipe: { id: string; title: string; saved?: boolean | undefined }
}) {
	const session = authClient.useSession()
	const account = session.data?.user
	const client = useQueryClient()
	const router = useRouter()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const [authOpen, setAuthOpen] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const [pending, setPending] = useState(false)

	const query = useQuery({
		queryKey: ['recipe', recipe.id, account?.id],
		queryFn: () => getRecipe({ data: { id: recipe.id } }),
		enabled: recipe.saved === undefined && !!account,
	})

	const saved = query.data?.saved ?? recipe.saved ?? false
	const owned = query.data?.owned ?? false
	const signedIn = !!account

	async function refresh() {
		// A reload already under way, like the one sign-in starts, read the recipe
		// before this change, and the router would hand its result to ours too.
		await router.latestLoadPromise

		return Promise.all([
			router.invalidate(),
			client.invalidateQueries({ queryKey: ['shelf'] }),
			client.invalidateQueries({ queryKey: ['recipe', recipe.id] }),
		])
	}

	async function update() {
		setPending(true)

		try {
			if (owned) return

			if (saved) {
				const removed = await removeSavedRecipe({ data: { id: recipe.id } })

				if (!removed) throw new Error('recipe could not be removed')
			} else await saveRecipe({ data: { id: recipe.id } })
			await refresh()
			setConfirming(false)
			toast.success(
				saved ? 'removed from your recipes' : 'saved to your recipes',
			)
		} catch {
			toast.error("couldn't update your recipes — try again")
		} finally {
			setPending(false)
		}
	}

	// Finishes the save a visitor asked for before signing in. The account they
	// signed into may already have it, or may be its author, so ask again
	// rather than trust what the page knew while signed out.
	const finishSave = useEffectEvent(async () => {
		setPending(true)

		try {
			const fresh = await getRecipe({ data: { id: recipe.id } })

			if (!fresh) throw new Error('recipe unavailable')

			if (!fresh.owned && !fresh.saved)
				await saveRecipe({ data: { id: recipe.id } })
			await refresh()

			if (!fresh.owned) toast.success('saved to your recipes')
		} catch {
			toast.error("couldn't save that recipe — try again")
		} finally {
			setPending(false)
		}
	})

	// Runs on the email path once the dialog's sign-in lands, and on the Google
	// path when the page loads again signed in.
	useEffect(() => {
		if (signedIn && takeAfterSignIn({ action: 'save', recipeId: recipe.id }))
			// It syncs with session storage and the session, both outside React.
			// oxlint-disable-next-line react/set-state-in-effect
			void finishSave()
	}, [signedIn, recipe.id])

	if (owned) return null

	return (
		<>
			<Button
				// Light, not the page's one solid: saving is offered, not pressed on.
				variant={saved ? 'saved' : 'outline'}
				disabled={
					pending ||
					session.isPending ||
					(signedIn && recipe.saved === undefined && query.isPending)
				}
				onClick={() => {
					if (!signedIn) {
						rememberAfterSignIn({ action: 'save', recipeId: recipe.id })
						setAuthOpen(true)
					} else if (saved) setConfirming(true)
					else void update()
				}}
			>
				<BookmarkSimpleIcon
					size={14}
					weight={saved ? 'fill' : 'bold'}
					aria-hidden
				/>
				{saved ? 'saved' : 'save'}
			</Button>
			<AuthDialog
				open={authOpen}
				onOpenChange={setAuthOpen}
				redirect={pathname}
				onSuccess={() => {
					onAuthenticated?.()
					void router.invalidate()
				}}
			/>
			<DeleteRecipeDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={recipe.title}
				shared
				pending={pending}
				onConfirm={() => void update()}
			/>
		</>
	)
}
