import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { FieldError, primaryActionClassName } from '@/components/recipe-form'
import { Button } from '@/components/ui/button'
import { fieldClassName } from '@/components/ui/input'
import { authClient } from '@/lib/auth/client'
import { getMySharingProfile, updateSharingProfile } from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

export function SharingProfileSettings() {
	const session = authClient.useSession()
	const account = session.data?.user

	const profile = useQuery({
		queryKey: ['sharing-profile', account?.id],
		queryFn: () => getMySharingProfile(),
		enabled: !!account && !account.isAnonymous,
	})

	if (
		session.isPending ||
		(profile.isPending && !!account && !account.isAnonymous)
	)
		return (
			<output className="text-muted-foreground">
				loading sharing settings…
			</output>
		)

	if (!account || account.isAnonymous)
		return (
			<p>
				create an account to share recipes.{' '}
				<Link to="/auth/signup" className="underline">
					keep my shelf
				</Link>
			</p>
		)

	if (profile.isError)
		return (
			<div role="alert">
				<p>couldn&apos;t load sharing settings.</p>
				<Button variant="outline" onClick={() => void profile.refetch()}>
					try again
				</Button>
			</div>
		)

	return (
		<SharingProfileForm
			profile={profile.data ?? null}
			onSaved={() => void profile.refetch()}
		/>
	)
}

function SharingProfileForm({
	profile,
	onSaved,
}: {
	profile: Awaited<ReturnType<typeof getMySharingProfile>>
	onSaved: () => void
}) {
	const [saved, setSaved] = useState(false)
	const [handle, setHandle] = useState(profile?.handle ?? '')
	const [displayName, setDisplayName] = useState(profile?.displayName ?? '')

	const update = useMutation({
		mutationFn: updateSharingProfile,
		onSuccess: () => {
			setSaved(true)
			onSaved()
		},
	})

	return (
		<form
			className="flex max-w-xl flex-col gap-6"
			onChange={() => setSaved(false)}
			onSubmit={(event) => {
				event.preventDefault()
				const data = new FormData(event.currentTarget)
				update.mutate({
					data: {
						handle,
						displayName: displayName,
						autoPublish: data.get('autoPublish') === 'on',
					},
				})
			}}
		>
			<div className="space-y-2">
				<label htmlFor="public-handle" className="text-sm font-semibold">
					public handle
				</label>
				<input
					className={cn(fieldClassName, 'min-h-11')}
					id="public-handle"
					name="handle"
					value={handle}
					onChange={(event) => setHandle(event.target.value)}
					placeholder="aria-amini"
					minLength={3}
					maxLength={40}
					pattern="[a-z0-9]+(-[a-z0-9]+)*"
					required
					autoCapitalize="none"
					autoCorrect="off"
				/>
				<p className="text-muted-foreground text-sm">
					your address is /{handle || 'your-handle'}. changing it changes your
					recipe links. your real name isn&apos;t required.
				</p>
			</div>
			<div className="space-y-2">
				<label htmlFor="public-display-name" className="text-sm font-semibold">
					public name
				</label>
				<input
					className={cn(fieldClassName, 'min-h-11')}
					id="public-display-name"
					name="displayName"
					value={displayName}
					onChange={(event) => setDisplayName(event.target.value)}
					placeholder="aria’s kitchen"
					maxLength={80}
					required
				/>
				<p className="text-muted-foreground text-sm">
					shown on your public profile and shared recipes.
				</p>
			</div>
			<label
				aria-label="automatically publish recipes i finish"
				htmlFor="auto-publish"
				className="flex items-start gap-3"
			>
				<input
					type="checkbox"
					id="auto-publish"
					name="autoPublish"
					defaultChecked={profile?.autoPublish ?? false}
					className="accent-kitchen-basil mt-1 size-5 shrink-0"
				/>
				<span>
					<span className="block font-semibold">
						automatically publish recipes i finish
					</span>
					<span className="text-muted-foreground mt-1 block text-sm">
						future recipes you write or adapt become public when you select
						done. anyone can read them, and search engines may index them.
						existing recipes and saved web imports stay as they are.
					</span>
				</span>
			</label>
			<p className="border-border border-t pt-4 text-sm">
				drafts, personal notes, and cooking history stay private. each finished
				recipe has its own sharing controls.
			</p>
			{update.isError ? <FieldError>{update.error.message}</FieldError> : null}
			<div className="flex flex-wrap items-center gap-4">
				<button
					className={cn(primaryActionClassName, 'min-h-11')}
					type="submit"
					disabled={update.isPending}
				>
					{update.isPending ? 'saving…' : 'save settings'}
				</button>
				{saved ? <output className="text-sm">saved</output> : null}
				{profile ? (
					<Link
						to="/$handle"
						params={{ handle: profile.handle }}
						className={cn(
							'focus-visible:outline-kitchen-eggplant text-sm font-semibold underline focus-visible:outline-2',
						)}
					>
						view public profile
					</Link>
				) : null}
			</div>
		</form>
	)
}
