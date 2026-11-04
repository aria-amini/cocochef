import { BookmarkSimpleIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { DeleteRecipeDialog } from '@/components/delete-recipe-dialog'
import { Button } from '@/components/ui/button'
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
		enabled: recipe.saved === undefined && !!account && !account.isAnonymous,
	})

	const saved = query.data?.saved ?? recipe.saved ?? false
	const owned = query.data?.owned ?? false

	async function update() {
		setPending(true)

		try {
			if (owned) return

			if (saved) {
				const removed = await removeSavedRecipe({ data: { id: recipe.id } })

				if (!removed) throw new Error('recipe could not be removed')
			} else await saveRecipe({ data: { id: recipe.id } })
			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: ['shelf'] }),
				client.invalidateQueries({ queryKey: ['recipe', recipe.id] }),
			])
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

	if (owned) return null

	return (
		<>
			<Button
				variant={saved ? 'saved' : 'outline'}
				disabled={
					pending ||
					session.isPending ||
					(!!account &&
						!account.isAnonymous &&
						recipe.saved === undefined &&
						query.isPending)
				}
				onClick={() => {
					if (!account || account.isAnonymous) setAuthOpen(true)
					else if (saved) setConfirming(true)
					else void update()
				}}
			>
				<BookmarkSimpleIcon
					size={14}
					weight={saved ? 'fill' : 'bold'}
					aria-hidden
					className="text-saved-blue"
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
