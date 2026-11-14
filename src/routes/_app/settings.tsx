import {
	CameraIcon,
	PencilSimpleIcon,
	SignOutIcon,
} from '@phosphor-icons/react'
import * as Sentry from '@sentry/tanstackstart-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/avatar'
import { PageTitle } from '@/components/page'
import { FieldError } from '@/components/recipe-form'
import { RecipeTransfer } from '@/components/recipe-transfer'
import {
	SettingsGroup,
	settingsActionClassName,
} from '@/components/settings-group'
import { PublicProfileSettings } from '@/components/sharing-profile'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'
import { getAvatarUploadUrl, getAvatarUrl } from '@/lib/s3'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/settings')({
	head: () => ({ meta: [{ title: 'settings · cocochef' }] }),
	component: Profile,
})

const pageClassName = 'flex w-full max-w-xl flex-col gap-8 p-6 md:p-10'

function Profile() {
	const session = authClient.useSession()
	const user = session.data?.user

	if (session.isPending) {
		return (
			<main className={pageClassName}>
				<PageTitle>settings</PageTitle>
				<p className="text-muted-foreground animate-pulse">loading…</p>
			</main>
		)
	}

	if (session.error) {
		return (
			<main className={pageClassName}>
				<PageTitle>settings</PageTitle>
				<FieldError>we couldn&apos;t check your session.</FieldError>
				<Button onClick={() => void session.refetch()}>try again</Button>
			</main>
		)
	}

	if (!user) {
		return (
			<main className={pageClassName}>
				<PageTitle>settings</PageTitle>
				<p className="text-muted-foreground">you are signed out.</p>
				<Link to="/auth/login" className={buttonVariants()}>
					sign in
				</Link>
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
			// A full load, not a navigation: the router's cached and preloaded
			// pages and the query cache were read for this account.
			window.location.assign('/')
		} catch {
			toast.error("couldn't sign you out — try again")
		} finally {
			setSigningOut(false)
		}
	}

	return (
		<main className={pageClassName}>
			<PageTitle>settings</PageTitle>
			<section aria-label="you" className="flex items-center gap-4">
				{/* The photo is its own button: a badge says it changes. */}
				<label
					className={cn(
						'focus-within:outline-kitchen-eggplant relative shrink-0 cursor-pointer rounded-xl focus-within:outline-2 focus-within:outline-offset-2',
						uploading && 'pointer-events-none opacity-50',
					)}
				>
					<Avatar
						name={name}
						src={avatar}
						size="profile"
						alt="Profile avatar"
					/>
					<span className="bg-card border-border absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full border">
						<CameraIcon size={14} weight="bold" aria-hidden />
					</span>
					<input
						aria-label={uploading ? 'uploading photo' : 'change photo'}
						type="file"
						accept="image/*"
						className="sr-only"
						onChange={upload}
						disabled={uploading}
					/>
				</label>
				<div className="flex min-w-0 flex-1 flex-col">
					<AccountName name={name} />
					<p className="text-muted-foreground truncate text-sm">{email}</p>
				</div>
			</section>
			<PublicProfileSettings accountId={userId} accountName={name} />
			<RecipeTransfer />
			<SettingsGroup>
				<button
					type="button"
					onClick={() => void signOut()}
					disabled={signingOut}
					className={settingsActionClassName}
				>
					<span className="flex-1">
						{signingOut ? 'signing out…' : 'sign out'}
					</span>
					<SignOutIcon size={16} weight="bold" aria-hidden />
				</button>
			</SettingsGroup>
		</main>
	)
}

// Your name, changed where it is shown: a pencil opens it as a field, and
// enter or save keeps it.
function AccountName({ name }: { name: string }) {
	const [editing, setEditing] = useState(false)
	const [value, setValue] = useState(name)
	const [saving, setSaving] = useState(false)
	const field = useRef<HTMLInputElement>(null)

	// Opened by the pencil, it is ready to type into.
	useEffect(() => {
		if (editing) field.current?.select()
	}, [editing])

	if (!editing)
		return (
			<div className="flex min-w-0 items-center gap-1">
				<p className="truncate text-lg font-bold">{name}</p>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="edit name"
					onClick={() => {
						setValue(name)
						setEditing(true)
					}}
				>
					<PencilSimpleIcon aria-hidden />
				</Button>
			</div>
		)

	const save = async () => {
		const next = value.trim()

		if (!next || next === name) {
			setEditing(false)

			return
		}

		setSaving(true)

		try {
			const { error } = await authClient.updateUser({ name: next })

			if (error) throw new Error(error.message)
			setEditing(false)
		} catch {
			toast.error("couldn't change your name — try again")
		} finally {
			setSaving(false)
		}
	}

	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(event) => {
				event.preventDefault()
				void save()
			}}
		>
			<Input
				aria-label="your name"
				value={value}
				onChange={(event) => setValue(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Escape') setEditing(false)
				}}
				maxLength={80}
				required
				ref={field}
				className="min-w-0"
			/>
			<Button type="submit" disabled={saving}>
				{saving ? 'saving…' : 'save'}
			</Button>
		</form>
	)
}
