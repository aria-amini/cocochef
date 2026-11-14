import {
	ArrowRightIcon,
	CopySimpleIcon,
	PencilSimpleIcon,
} from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { FieldError } from '@/components/recipe-form'
import {
	SettingsGroup,
	settingsActionClassName,
	settingsRowClassName,
} from '@/components/settings-group'
import { Button } from '@/components/ui/button'
import { fieldClassName, Input } from '@/components/ui/input'
import { getMySharingProfile, updateSharingProfile } from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

type Profile = Awaited<ReturnType<typeof getMySharingProfile>>

type Saved = Awaited<ReturnType<typeof updateSharingProfile>>

// The site's own address, for showing a page's whole link. Empty while
// rendering on the server, where there is no window to ask.
function useHost() {
	return useSyncExternalStore(
		() => () => undefined,
		() => window.location.host,
		() => '',
	)
}

// A handle to start from: the account's name, as an address would spell it.
function handleFrom(name: string) {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
}

// Your public page, as one card: whose it is and where it lives, a way to
// open or pass it on, and the two things to change about it behind edit.
export function PublicProfileSettings({
	accountId,
	accountName,
}: {
	accountId: string
	accountName: string
}) {
	const queryClient = useQueryClient()
	const key = ['sharing-profile', accountId]

	const profile = useQuery({
		queryKey: key,
		queryFn: () => getMySharingProfile(),
	})

	// One line under the card: whether the page is live, and what never is.
	const hint = profile.data?.isPublic
		? 'only recipes you publish show on your page. drafts, notes and cooking history stay private.'
		: 'your page goes live once you publish a recipe. drafts, notes and cooking history stay private.'

	if (profile.isPending)
		return (
			<SettingsGroup id="public-profile" title="public profile" hint={hint}>
				<output className={cn(settingsRowClassName, 'text-muted-foreground')}>
					loading…
				</output>
			</SettingsGroup>
		)

	if (profile.isError)
		return (
			<SettingsGroup id="public-profile" title="public profile">
				<div role="alert" className={settingsRowClassName}>
					<p className="flex-1">couldn&apos;t load your public profile.</p>
					<Button variant="outline" onClick={() => void profile.refetch()}>
						try again
					</Button>
				</div>
			</SettingsGroup>
		)

	return (
		<SettingsGroup id="public-profile" title="public profile" hint={hint}>
			<ProfileCard
				profile={profile.data}
				accountName={accountName}
				onSaved={(saved) => {
					// The saved handle and name are in place before edit can open
					// again, so a quick second edit never starts from the old ones.
					queryClient.setQueryData<Profile>(key, (now) => ({
						...now,
						...saved,
						isPublic: now?.isPublic ?? false,
					}))
					void profile.refetch()
				}}
			/>
		</SettingsGroup>
	)
}

function ProfileCard({
	profile,
	accountName,
	onSaved,
}: {
	profile: Profile
	accountName: string
	onSaved: (saved: Saved) => void
}) {
	const host = useHost()
	// Without a page yet, the card opens on setting one up.
	const [editing, setEditing] = useState(!profile)

	if (editing || !profile)
		return (
			<ProfileForm
				profile={profile}
				accountName={accountName}
				host={host}
				onCancel={profile ? () => setEditing(false) : undefined}
				onSaved={(saved) => {
					onSaved(saved)
					setEditing(false)
				}}
			/>
		)

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(
				`${window.location.origin}/${profile.handle}`,
			)
			toast.success('link copied')
		} catch {
			toast.error("couldn't copy the link — try again")
		}
	}

	return (
		<>
			<div className={settingsRowClassName}>
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-base font-bold">
						{profile.displayName}
					</span>
					<span className="text-muted-foreground truncate text-sm font-semibold">
						{host}/{profile.handle}
					</span>
				</div>
				<Button variant="ghost" onClick={() => setEditing(true)}>
					<PencilSimpleIcon aria-hidden />
					edit
				</Button>
			</div>
			{profile.isPublic ? (
				<>
					<Link
						to="/$handle"
						params={{ handle: profile.handle }}
						className={settingsActionClassName}
					>
						<span className="flex-1">view your page</span>
						<ArrowRightIcon size={16} weight="bold" aria-hidden />
					</Link>
					<button
						type="button"
						className={settingsActionClassName}
						onClick={() => void copy()}
					>
						<span className="flex-1">copy link</span>
						<CopySimpleIcon size={16} weight="bold" aria-hidden />
					</button>
				</>
			) : null}
		</>
	)
}

function ProfileForm({
	profile,
	accountName,
	host,
	onCancel,
	onSaved,
}: {
	profile: Profile
	accountName: string
	host: string
	onCancel?: (() => void) | undefined
	onSaved: (saved: Saved) => void
}) {
	const [handle, setHandle] = useState(
		profile?.handle ?? handleFrom(accountName),
	)

	const [displayName, setDisplayName] = useState(
		profile?.displayName ?? accountName,
	)

	const nameId = useId()
	const linkId = useId()

	const update = useMutation({
		mutationFn: updateSharingProfile,
		onSuccess: (saved) => {
			toast.success('profile saved')
			onSaved(saved)
		},
	})

	const unchanged =
		!!profile &&
		handle === profile.handle &&
		displayName === profile.displayName

	return (
		<form
			className="flex flex-col gap-4 p-4"
			onSubmit={(event) => {
				event.preventDefault()
				update.mutate({ data: { handle, displayName } })
			}}
		>
			<div className="flex flex-col gap-1.5">
				<label htmlFor={nameId} className="text-sm font-semibold">
					name on your page
				</label>
				<Input
					id={nameId}
					name="displayName"
					value={displayName}
					onChange={(event) => setDisplayName(event.target.value)}
					maxLength={80}
					required
				/>
			</div>
			<div className="flex flex-col gap-1.5 text-sm font-semibold">
				<label htmlFor={linkId}>your link</label>
				{/* The address reads whole as it is typed. */}
				<span
					className={cn(
						fieldClassName,
						'focus-within:outline-kitchen-eggplant flex items-center p-0 focus-within:outline-2 focus-within:outline-offset-2',
					)}
				>
					<span className="text-muted-foreground shrink-0 py-3 pl-4 font-normal">
						/
					</span>
					<input
						id={linkId}
						name="handle"
						value={handle}
						onChange={(event) => setHandle(event.target.value.toLowerCase())}
						minLength={3}
						maxLength={40}
						pattern="[a-z0-9]+(-[a-z0-9]+)*"
						title="letters, numbers, and single hyphens"
						required
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						className="min-w-0 flex-1 bg-transparent py-3 pr-4 pl-0.5 outline-none"
					/>
				</span>
				<span className="text-muted-foreground truncate font-normal">
					{host}/{handle || '…'}
					{profile ? ' · changing it changes your recipe links' : ''}
				</span>
			</div>
			{update.isError ? <FieldError>{update.error.message}</FieldError> : null}
			<div className="flex justify-end gap-2">
				{onCancel ? (
					<Button type="button" variant="ghost" onClick={onCancel}>
						cancel
					</Button>
				) : null}
				<Button type="submit" disabled={update.isPending || unchanged}>
					{update.isPending ? 'saving…' : profile ? 'save' : 'set up my page'}
				</Button>
			</div>
		</form>
	)
}
