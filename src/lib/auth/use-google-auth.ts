import { useState } from 'react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth/client'

export type UseGoogleAuthOptions = {
	fallbackRedirect: string
}

function sanitizeRedirect(candidate: string): string {
	try {
		const url = new URL(candidate, window.location.origin)

		if (url.origin !== window.location.origin) return '/'

		return url.pathname + url.search + url.hash
	} catch {
		return '/'
	}
}

export function useGoogleAuth({ fallbackRedirect }: UseGoogleAuthOptions) {
	const [isLoading, setIsLoading] = useState(false)
	const [isAvailable, setIsAvailable] = useState(true)

	const signIn = async () => {
		setIsLoading(true)
		const safeRedirect = sanitizeRedirect(fallbackRedirect)
		const callbackURL = new URL(safeRedirect, window.location.origin).toString()

		try {
			const { data, error } = await authClient.signIn.social({
				provider: 'google',
				callbackURL,
			})

			if (error) {
				throw error
			}

			window.location.assign(data?.url ?? safeRedirect)
		} catch (error) {
			if (
				error instanceof Object &&
				'code' in error &&
				error.code === 'PROVIDER_NOT_FOUND'
			) {
				setIsAvailable(false)
				toast.error(
					'Google login is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.',
				)
			} else {
				toast.error("google sign-in didn't work — try again")
			}

			setIsLoading(false)
		}
	}

	return { signIn, isLoading, isAvailable }
}
