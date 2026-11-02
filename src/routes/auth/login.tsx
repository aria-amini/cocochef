import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { AuthField, AuthShell } from '@/components/auth-form'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { redirectAuthenticatedUsers } from '@/lib/auth/functions'

export const Route = createFileRoute('/auth/login')({
	beforeLoad: redirectAuthenticatedUsers,
	validateSearch: z.object({ redirect: z.string().optional() }),
	component: Login,
})

function Login() {
	const navigate = useNavigate()
	const search = Route.useSearch()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [pending, setPending] = useState(false)

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (pending) return
		setPending(true)

		try {
			const result = await authClient.signIn.email({
				email,
				password,
				callbackURL: search.redirect ?? '/',
			})

			if (result.error) toast.error(result.error.message)
			else await navigate({ to: search.redirect ?? '/' })
		} catch {
			toast.error("couldn't sign you in — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<AuthShell
			title="sign in"
			googleRedirect={search.redirect ?? '/recipes'}
			footer={
				<>
					new here?{' '}
					<Link to="/auth/signup" className="font-semibold underline">
						create an account
					</Link>
				</>
			}
		>
			<form onSubmit={submit} className="flex flex-col gap-4">
				<AuthField
					label="email"
					required
					type="email"
					autoComplete="email"
					placeholder="you@example.com"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
				<AuthField
					label="password"
					required
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
				/>
				<Button type="submit" size="lg" className="w-full" disabled={pending}>
					{pending ? 'signing in…' : 'sign in'}
				</Button>
			</form>
		</AuthShell>
	)
}
