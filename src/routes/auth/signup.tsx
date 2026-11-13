import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { AuthField, AuthShell } from '@/components/auth-form'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { redirectAuthenticatedUsers } from '@/lib/auth/functions'

export const Route = createFileRoute('/auth/signup')({
	beforeLoad: redirectAuthenticatedUsers,
	component: Signup,
})

function Signup() {
	const navigate = useNavigate()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [pending, setPending] = useState(false)

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (pending) return
		setPending(true)

		try {
			const { error } = await authClient.signUp.email({ name, email, password })

			if (error) toast.error(error.message)
			else await navigate({ to: '/' })
		} catch {
			toast.error("couldn't create your account — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<AuthShell
			title="create an account"
			footer={
				<>
					already have an account?{' '}
					<Link to="/auth/login" className="font-semibold underline">
						sign in
					</Link>
				</>
			}
		>
			<form onSubmit={submit} className="flex flex-col gap-4">
				<AuthField
					label="name"
					required
					autoComplete="name"
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
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
					minLength={8}
					type="password"
					autoComplete="new-password"
					placeholder="at least 8 characters"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
				/>
				<Button type="submit" size="lg" className="w-full" disabled={pending}>
					{pending ? 'creating your account…' : 'create account'}
				</Button>
			</form>
		</AuthShell>
	)
}
