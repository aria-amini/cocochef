import { CameraIcon } from '@phosphor-icons/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/avatar'
import { PageTitle } from '@/components/page'
import { FieldError } from '@/components/recipe-form'
import { RecipeTransfer } from '@/components/recipe-transfer'
import { Button, buttonVariants } from '@/components/ui/button'
import { authClient } from '@/lib/auth/client'
import { getAvatarUploadUrl, getAvatarUrl } from '@/lib/s3'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/profile')({
	component: Profile,
})

const pageClassName = 'flex w-full max-w-2xl flex-col gap-8 p-6 md:p-10'

const sectionTitleClassName = 'text-lg font-bold'

function Profile() {
	const session = authClient.useSession()
	const user = session.data?.user

	if (session.isPending) {
		return (
			<main className={pageClassName}>
				<PageTitle>profile</PageTitle>
				<p className="text-muted-foreground animate-pulse">loading…</p>
			</main>
		)
	}

	if (session.error) {
		return (
			<main className={pageClassName}>
				<PageTitle>profile</PageTitle>
				<FieldError>we couldn&apos;t check your session.</FieldError>
				<Button onClick={() => void session.refetch()}>try again</Button>
			</main>
		)
	}

	if (!user) {
		return (
			<main className={pageClassName}>
				<PageTitle>profile</PageTitle>
				<p className="text-muted-foreground">you are signed out.</p>
				<Link to="/auth/login" className={buttonVariants()}>
					sign in
				</Link>
			</main>
		)
	}

	if (user.isAnonymous) {
		return (
			<main className={pageClassName}>
				<PageTitle>guest cook</PageTitle>
				<div className="border-foreground/50 flex flex-col items-start gap-4 rounded-xl border border-dashed p-5">
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
				if (!stale) toast.error("couldn't load your photo — try again")
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

			if (!response.ok) {
				const detail = (await response.text()).slice(0, 300)

				throw new Error(`Avatar upload failed (${response.status}): ${detail}`)
			}

			const { error } = await authClient.updateUser({ image: key })

			if (error) throw new Error(error.message)
			setAvatar(await getAvatarUrl({ data: { image: key } }))
		} catch (error) {
			Sentry.captureException(error, {
				tags: { upload: 'avatar' },
				extra: { type: file.type, size: file.size },
			})
			toast.error("couldn't upload that photo — try again")
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
			toast.error("couldn't sign you out — try again")
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<main className={pageClassName}>
			<PageTitle>profile</PageTitle>
			<section className="flex items-center gap-5">
				<Avatar name={name} src={avatar} size="xl" alt="Profile avatar" />
				<div className="flex min-w-0 flex-col items-start gap-1">
					<p className="truncate text-lg font-bold">{name}</p>
					<p className="text-muted-foreground truncate text-sm">{email}</p>
					<label
						className={cn(
							buttonVariants({ variant: 'outline' }),
							'focus-within:outline-kitchen-eggplant mt-2 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2',
							uploading && 'pointer-events-none opacity-50',
						)}
					>
						<CameraIcon aria-hidden />
						{uploading ? 'uploading…' : 'change photo'}
						<input
							aria-label="Profile photo"
							type="file"
							accept="image/*"
							className="sr-only"
							onChange={upload}
							disabled={uploading}
						/>
					</label>
				</div>
			</section>
			<section className="flex flex-col items-start gap-3">
				<h2 className={sectionTitleClassName}>sharing</h2>
				<p className="text-muted-foreground text-sm">
					pick a handle and publish the recipes you want to pass around.
				</p>
				<Link
					to="/profile/sharing"
					className={buttonVariants({ variant: 'outline' })}
				>
					sharing &amp; public profile
				</Link>
			</section>
			<RecipeTransfer />
			<section className="border-border border-t pt-6">
				<Button variant="outline" onClick={signOut} disabled={signingOut}>
					{signingOut ? 'signing out…' : 'sign out'}
				</Button>
			</section>
		</main>
	)
}
