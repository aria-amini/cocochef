import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useState } from 'react'

import { AuthDialog } from '@/components/auth-dialog'
import { rememberAfterSignIn, takeAfterSignIn } from '@/lib/auth/after-sign-in'
import { authClient } from '@/lib/auth/client'

// Editing a recipe someone else wrote. Nothing is copied yet: the editor
// opens on it, and only saving a change makes the cook's own copy, which then
// takes the shared one's place on their shelf. Opened here when `onEdit` is
// given, otherwise on the recipe's own page.
export function useEditShared({
	recipeId,
	onEdit,
}: {
	recipeId: string
	onEdit?: (() => void) | undefined
}) {
	const session = authClient.useSession()
	const navigate = useNavigate()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const [authOpen, setAuthOpen] = useState(false)

	const signedIn = !!session.data?.user

	function open() {
		if (onEdit) onEdit()
		else
			void navigate({
				to: '/recipes/$recipeId',
				params: { recipeId },
				state: { editing: true },
			})
	}

	function edit() {
		if (signedIn) open()
		else {
			rememberAfterSignIn({ action: 'edit', recipeId })
			setAuthOpen(true)
		}
	}

	// Opens the editor asked for before signing in: on the email path once the
	// dialog's sign-in lands, on the Google path when the page loads again.
	const finishEdit = useEffectEvent(open)

	useEffect(() => {
		if (signedIn && takeAfterSignIn({ action: 'edit', recipeId })) finishEdit()
	}, [signedIn, recipeId])

	return {
		edit,
		pending: session.isPending,
		dialog: (
			<AuthDialog
				open={authOpen}
				onOpenChange={setAuthOpen}
				redirect={pathname}
			/>
		),
	}
}
