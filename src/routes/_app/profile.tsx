import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/avatar'
import { RecipeTransfer } from '@/components/recipe-transfer'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'
import { getAvatarUploadUrl, getAvatarUrl } from '@/lib/s3'

export const Route = createFileRoute('/_app/profile')({
	component: Profile,
})

function Profile() {
	const session = authClient.useSession()
	const user = session.data?.user

	if (session.isPending) {
		return (
			<main className="mx-auto min-h-dvh max-w-xl space-y-8 p-6">
				<h1 className="text-4xl font-semibold">Profile</h1>
				<p className="text-muted-foreground animate-pulse">loading…</p>
			</main>
		)
	}

	if (session.error) {
		return (
			<main className="mx-auto min-h-dvh max-w-xl space-y-8 p-6">
				<h1 className="text-4xl font-semibold">Profile</h1>
				<p role="alert" className="text-destructive">
					we couldn&apos;t check your session.
				</p>
				<Button onClick={() => void session.refetch()}>try again</Button>
			</main>
		)
	}

	if (!user) {
		return (
			<main className="mx-auto min-h-dvh max-w-xl space-y-8 p-6">
				<h1 className="text-4xl font-semibold">Profile</h1>
				<p className="text-muted-foreground">you are signed out.</p>
				<Link to="/auth/login" className={buttonVariants()}>
					sign in
				</Link>
			</main>
		)
	}

	if (user.isAnonymous) {
		return (
			<main className="mx-auto min-h-dvh max-w-xl space-y-8 p-6">
				<h1 className="text-4xl font-semibold">guest cook</h1>
				<div className="border-border space-y-4 rounded-xl border border-dashed p-4">
					<p className="text-sm font-semibold">
						no account yet — your shelf lives only in this browser. make an
						account to keep it on any device.
					</p>
					<Link to="/auth/signup" className={buttonVariants()}>
						keep my shelf
					</Link>
				</div>
				<RecipeTransfer />
			</main>
		)
	}

	return (
		<AccountProfile
			userId={user.id}
			name={user.name}
			email={user.email}
			image={user.image}
		/>
	)
}

function AccountProfile({
	userId,
	name,
	email,
	image,
}: {
	userId: string
	name: string
	email: string
	image?: string | null | undefined
}) {
	const navigate = useNavigate()
	const [avatar, setAvatar] = useState<string>()
	const [uploading, setUploading] = useState(false)
	const [signingOut, setSigningOut] = useState(false)

	useEffect(() => {
		let stale = false
		void getAvatarUrl({ data: { image } })
			.then((url) => {
				if (!stale) setAvatar(url)
			})
			.catch(() => {
				if (!stale) toast.error('Could not load your photo. Try again.')
			})

		return () => {
			stale = true
		}
	}, [image])

	const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		event.target.value = ''

		if (!file) return
		setUploading(true)

		try {
			const key = `avatars/${userId}-${crypto.randomUUID()}`
			const { url } = await getAvatarUploadUrl({ data: { key } })

			const response = await fetch(url, {
				method: 'PUT',
				headers: { 'Content-Type': file.type },
				body: file,
			})

			if (!response.ok) throw new Error('Upload failed')
			const { error } = await authClient.updateUser({ image: key })

			if (error) throw new Error(error.message)
			setAvatar(await getAvatarUrl({ data: { image: key } }))
		} catch {
			toast.error('could not upload that photo — try again')
		} finally {
			setUploading(false)
		}
	}

	const signOut = async () => {
		setSigningOut(true)

		try {
			const { error } = await authClient.signOut()

			if (error) throw new Error(error.message)
			await navigate({ to: '/' })
		} catch {
			toast.error('Could not sign out. Try again.')
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<main className="mx-auto min-h-dvh max-w-xl space-y-8 p-6">
			<h1 className="text-4xl font-semibold">Profile</h1>
			<Link
				to="/profile/sharing"
				className="inline-block text-sm font-semibold underline"
			>
				sharing & public profile
			</Link>
			<div className="space-y-4">
				<p>{name}</p>
				<p className="text-muted-foreground">{email}</p>
				<Avatar name={name} src={avatar} size="xl" alt="Profile avatar" />
				<Input
					aria-label="Profile photo"
					type="file"
					accept="image/*"
					onChange={upload}
					disabled={uploading}
				/>
				{uploading ? (
					<p className="text-muted-foreground animate-pulse text-sm">
						uploading…
					</p>
				) : null}
				<Button variant="outline" onClick={signOut} disabled={signingOut}>
					{signingOut ? 'Signing out…' : 'Sign out'}
				</Button>
			</div>
			<RecipeTransfer />
		</main>
	)
}
