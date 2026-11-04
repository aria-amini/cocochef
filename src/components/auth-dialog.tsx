import { useState } from 'react'

import { AuthField } from '@/components/auth-form'
import { GoogleAuthButton } from '@/components/google-auth-button'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { authClient } from '@/lib/auth/client'
import { formatShelfStats, useShelfStats } from '@/lib/use-shelf-stats'

type Mode = 'signup' | 'signin'

export function AuthDialog({
	open,
	onOpenChange,
	redirect,
	initialMode = 'signup',
	onSuccess,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	redirect: string
	initialMode?: Mode
	onSuccess?: () => void
}) {
	const [mode, setMode] = useState<Mode>(initialMode)
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<string>()
	const session = authClient.useSession()
	const isGuest = Boolean(session.data?.user.isAnonymous)
	const stats = useShelfStats(isGuest ? session.data?.user.id : undefined)
	const shelfSummary = stats ? formatShelfStats(stats) : ''

	// A password typed into a closed dialog should not be waiting when it reopens.
	function reset() {
		setMode(initialMode)
		setName('')
		setEmail('')
		setPassword('')
		setError(undefined)
	}

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (pending) return
		setPending(true)
		setError(undefined)

		try {
			const result =
				mode === 'signup'
					? await authClient.signUp.email({ name, email, password })
					: await authClient.signIn.email({
							email,
							password,
							callbackURL: redirect,
						})

			if (result.error)
				setError(result.error.message ?? 'something went wrong — try again')
			else {
				await session.refetch()
				onOpenChange(false)
				reset()
				onSuccess?.()
			}
		} catch {
			setError(
				mode === 'signup'
					? "couldn't create your account — try again"
					: "couldn't sign you in — try again",
			)
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) reset()
				onOpenChange(next)
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{mode === 'signup' ? 'create an account' : 'sign in'}
					</DialogTitle>
					<DialogDescription>
						{mode === 'signup'
							? shelfSummary
								? `keep your ${shelfSummary} on any device once you have an account.`
								: 'keep your recipes and kitchen on any device.'
							: 'welcome back to your kitchen.'}
					</DialogDescription>
				</DialogHeader>
				<GoogleAuthButton fallbackRedirect={redirect} className="w-full" />
				<div className="text-muted-foreground flex items-center gap-3 text-xs font-semibold">
					<span className="bg-border h-px flex-1" />
					or with email
					<span className="bg-border h-px flex-1" />
				</div>
				<form
					onSubmit={(event) => void submit(event)}
					className="flex flex-col gap-4"
				>
					{mode === 'signup' ? (
						<AuthField
							label="name"
							required
							autoComplete="name"
							value={name}
							onChange={(event) => {
								setName(event.target.value)
								setError(undefined)
							}}
						/>
					) : null}
					<AuthField
						label="email"
						required
						type="email"
						autoComplete="email"
						placeholder="you@example.com"
						value={email}
						onChange={(event) => {
							setEmail(event.target.value)
							setError(undefined)
						}}
					/>
					<AuthField
						label="password"
						required
						minLength={mode === 'signup' ? 8 : undefined}
						type="password"
						autoComplete={
							mode === 'signup' ? 'new-password' : 'current-password'
						}
						value={password}
						onChange={(event) => {
							setPassword(event.target.value)
							setError(undefined)
						}}
					/>
					{error ? (
						<p role="alert" className="text-sm font-semibold">
							{error}
						</p>
					) : null}
					<Button type="submit" size="lg" className="w-full" disabled={pending}>
						{pending
							? mode === 'signup'
								? 'creating your account…'
								: 'signing in…'
							: mode === 'signup'
								? 'create account'
								: 'sign in'}
					</Button>
				</form>
				<p>
					{mode === 'signup' ? 'already have an account? ' : 'new here? '}
					<button
						type="button"
						className="font-semibold underline"
						onClick={() => {
							setMode(mode === 'signup' ? 'signin' : 'signup')
							setError(undefined)
						}}
					>
						{mode === 'signup' ? 'sign in' : 'create an account'}
					</button>
				</p>
			</DialogContent>
		</Dialog>
	)
}
