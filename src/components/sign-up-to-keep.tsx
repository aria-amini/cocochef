import { useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

import { AuthDialog } from '@/components/auth-dialog'
import { buttonVariants } from '@/components/ui/button'

// A page that keeps something for the cook, seen signed out: what it would
// keep, and the account that keeps it. Dashed, since none of it is real yet.
export function SignUpToKeep({
	picture,
	title,
	body,
}: {
	picture: React.ReactNode
	title: string
	body: string
}) {
	const router = useRouter()

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const [mode, setMode] = useState<'signup' | 'signin'>()

	return (
		<section
			aria-labelledby="sign-up-to-keep"
			className="border-foreground/30 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center"
		>
			{picture}
			<div className="flex flex-col gap-1">
				<h2 id="sign-up-to-keep" className="text-lg font-bold">
					{title}
				</h2>
				<p className="text-muted-foreground max-w-xs text-sm font-semibold">
					{body}
				</p>
			</div>
			<button
				type="button"
				onClick={() => setMode('signup')}
				className={buttonVariants({ className: 'min-h-11' })}
			>
				create an account
			</button>
			<p className="text-sm">
				already have one?{' '}
				<button
					type="button"
					onClick={() => setMode('signin')}
					className="font-semibold underline"
				>
					sign in
				</button>
			</p>
			{mode ? (
				<AuthDialog
					open
					initialMode={mode}
					onOpenChange={(open) => !open && setMode(undefined)}
					redirect={pathname}
					// Signed in, the page loads again with what the account keeps.
					onSuccess={() => void router.invalidate()}
				/>
			) : null}
		</section>
	)
}
