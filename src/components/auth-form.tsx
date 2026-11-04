import { Link } from '@tanstack/react-router'

import { GoogleAuthButton } from '@/components/google-auth-button'
import { PageTitle } from '@/components/page'
import { Input } from '@/components/ui/input'

// Sign-in and sign-up share one quiet column on the paper: the wordmark home,
// the title, Google, then the form.
export function AuthShell({
	title,
	intro,
	googleRedirect = '/recipes',
	children,
	footer,
}: {
	title: string
	intro?: React.ReactNode
	googleRedirect?: string
	children: React.ReactNode
	footer: React.ReactNode
}) {
	return (
		<main className="grid min-h-dvh place-items-center p-6">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<Link
					to="/"
					className="self-start rounded-md text-sm font-bold tracking-tight"
				>
					dutch-oven
				</Link>
				<div className="flex flex-col gap-2">
					<PageTitle>{title}</PageTitle>
					{intro ? (
						<p className="text-muted-foreground text-sm">{intro}</p>
					) : null}
				</div>
				<GoogleAuthButton
					fallbackRedirect={googleRedirect}
					className="w-full"
				/>
				<div className="text-muted-foreground flex items-center gap-3 text-xs font-semibold">
					<span className="bg-border h-px flex-1" />
					or with email
					<span className="bg-border h-px flex-1" />
				</div>
				{children}
				<p className="text-sm">{footer}</p>
			</div>
		</main>
	)
}

// A field with its name above it, so the name stays once something is typed.
export function AuthField({
	label,
	...props
}: { label: string } & React.ComponentProps<typeof Input>) {
	return (
		<label className="flex flex-col gap-1.5 text-sm font-semibold">
			{label}
			<Input {...props} />
		</label>
	)
}
