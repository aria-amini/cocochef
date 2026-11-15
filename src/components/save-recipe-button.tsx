import { BookmarkSimpleIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import {
	useEffect,
	useEffectEvent,
	useOptimistic,
	useState,
	useTransition,
} from 'react'
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

	const known = query.data?.saved ?? recipe.saved ?? false
	// Saving shows at the tap, and stays until the recipe is read again; a
	// failure shows what the server still has.
	const [saved, showSaved] = useOptimistic(known)
	const [updating, startUpdate] = useTransition()
	const owned = query.data?.owned ?? false
	const signedIn = !!account

	async function refresh() {
		// A reload already under way, like the one sign-in starts, read the recipe
		// before this change, and the router would hand its result to ours too.
		await router.latestLoadPromise

		// Sync: resolves once the page is read again, not as the read starts,
		// so a save shown at the tap stays shown until the page agrees.
		return Promise.all([
			router.invalidate({ sync: true }),
			client.invalidateQueries({ queryKey: ['shelf'] }),
			client.invalidateQueries({ queryKey: ['recipe', recipe.id] }),
		])
	}

	function update() {
		if (owned) return

		setConfirming(false)
		startUpdate(async () => {
			showSaved(!saved)

			try {
				if (saved) {
					const removed = await removeSavedRecipe({ data: { id: recipe.id } })

					if (!removed) throw new Error('recipe could not be removed')
				} else await saveRecipe({ data: { id: recipe.id } })
				toast.success(
					saved ? 'removed from your recipes' : 'saved to your recipes',
				)
			} catch {
				toast.error("couldn't update your recipes — try again")
			}

			// The change is made; a failed read only leaves the page as it was.
			await refresh().catch(() => undefined)
		})
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
					updating ||
					session.isPending ||
					(signedIn && recipe.saved === undefined && query.isPending)
				}
				onClick={() => {
					if (!signedIn) {
						rememberAfterSignIn({ action: 'save', recipeId: recipe.id })
						setAuthOpen(true)
					} else if (saved) setConfirming(true)
					else update()
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
				pending={false}
				onConfirm={update}
			/>
		</>
	)
}
