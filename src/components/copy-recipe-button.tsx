import { PencilSimpleIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { copyRecipe } from '@/lib/recipes/server'

export function CopyRecipeButton({ recipeId }: { recipeId: string }) {
	const session = authClient.useSession()
	const navigate = useNavigate()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const client = useQueryClient()
	const [authOpen, setAuthOpen] = useState(false)
	const [pending, setPending] = useState(false)

	async function copy() {
		if (!session.data?.user || session.data.user.isAnonymous) {
			setAuthOpen(true)

			return
		}

		setPending(true)

		try {
			const result = await copyRecipe({ data: { id: recipeId } })

			if (!result) throw new Error('recipe unavailable')
			await client.invalidateQueries({ queryKey: ['shelf'] })

			if (result.path) await navigate({ href: result.path })
			else
				await navigate({
					to: '/recipes/$recipeId',
					params: { recipeId: result.id },
				})
			toast.success('copied to your recipes')
		} catch {
			toast.error("couldn't copy that recipe — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<>
			<Button
				variant="ghost"
				title="a copy is yours to edit; save keeps the original as it is"
				disabled={pending || session.isPending}
				onClick={() => void copy()}
			>
				<PencilSimpleIcon size={14} weight="bold" aria-hidden />
				{pending ? 'copying…' : 'copy to my shelf'}
			</Button>
			<AuthDialog
				open={authOpen}
				onOpenChange={setAuthOpen}
				redirect={pathname}
			/>
		</>
	)
}
