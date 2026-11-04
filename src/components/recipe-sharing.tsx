import { ShareNetworkIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { FieldError, primaryActionClassName } from '@/components/recipe-form'
import { ExportRecipeButton } from '@/components/recipe-transfer'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog'
import { authClient } from '@/lib/auth/client'
import {
	createWebSharingLink,
	getMyRecipeShare,
	getMySharingProfile,
	updateRecipeShare,
} from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

// The one place for getting a recipe out of the app: a link to it, or a file.
export function RecipeSharing({
	recipe,
	imported,
}: {
	recipe: { id: string; title: string }
	imported: boolean
}) {
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className={buttonVariants({ variant: 'ghost' })}
				onClick={() => setOpen(true)}
			>
				<ShareNetworkIcon size={14} weight="bold" aria-hidden />
				share
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogTitle>share recipe</DialogTitle>
					<DialogDescription>
						share the recipe without sharing your notes or cooking history.
					</DialogDescription>
					{open ? (
						<SharingOptions
							key={recipe.id}
							recipeId={recipe.id}
							imported={imported}
						/>
					) : null}
					<div className="border-border space-y-2 border-t pt-4">
						<p className="text-muted-foreground text-sm">
							or save a backup file, with your notes, to import into another
							dutch-oven. uploaded photos aren't included.
						</p>
						<ExportRecipeButton recipe={recipe} />
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}

function SharingOptions({
	recipeId,
	imported,
}: {
	recipeId: string
	imported: boolean
}) {
	const session = authClient.useSession()
	const account = session.data?.user
	const client = useQueryClient()

	const profile = useQuery({
		queryKey: ['sharing-profile', account?.id],
		queryFn: () => getMySharingProfile(),
	})

	const shareKey = ['recipe-share', account?.id, recipeId]

	const share = useQuery({
		queryKey: shareKey,
		queryFn: () => getMyRecipeShare({ data: { id: recipeId } }),
	})

	const [webPath, setWebPath] = useState<string>()
	const [copied, setCopied] = useState(false)
	const [copyError, setCopyError] = useState(false)

	const update = useMutation({
		mutationFn: updateRecipeShare,
		onSuccess: (value) => {
			client.setQueryData(shareKey, value)
			setCopied(false)
		},
	})

	const web = useMutation({
		mutationFn: () => createWebSharingLink({ data: { id: recipeId } }),
		onSuccess: (value) => {
			if (value) setWebPath(`/sites/${value.site}/${value.slug}`)
		},
	})

	const visibility = share.data?.visibility ?? 'private'

	const path =
		visibility === 'public' && profile.data && share.data
			? `/${profile.data.handle}/${share.data.slug}`
			: visibility === 'unlisted' && share.data
				? `/s/${share.data.token}`
				: undefined

	const copy = async (value: string) => {
		try {
			await navigator.clipboard.writeText(
				new URL(value, window.location.origin).href,
			)
			setCopied(true)
			setCopyError(false)
		} catch {
			setCopyError(true)
		}
	}

	return (
		<div className="space-y-5">
			{imported ? (
				<div className="border-border space-y-3 border-b pb-5">
					<p className="text-sm">
						this web recipe has a shared source page. sharing that link
						doesn&apos;t reveal that it&apos;s on your shelf.
					</p>
					<Button
						variant="outline"
						disabled={web.isPending}
						onClick={() => web.mutate()}
					>
						{web.isPending ? 'creating link…' : 'get source recipe link'}
					</Button>
					{webPath ? <ShareAddress path={webPath} onCopy={copy} /> : null}
					{web.isError ? <FieldError>{web.error.message}</FieldError> : null}
				</div>
			) : null}
			{session.isPending || profile.isPending || share.isPending ? (
				<output>loading sharing options…</output>
			) : !account || account.isAnonymous ? (
				<p className="text-sm">
					<Link to="/auth/signup" className="underline">
						create an account
					</Link>{' '}
					to publish your own recipes.
				</p>
			) : profile.isError || share.isError ? (
				<div role="alert">
					<p>couldn&apos;t load sharing options.</p>
					<Button
						variant="outline"
						onClick={() => {
							void profile.refetch()
							void share.refetch()
						}}
					>
						try again
					</Button>
				</div>
			) : !profile.data ? (
				<p className="text-sm">
					<Link to="/profile/sharing" className="font-semibold underline">
						choose a public handle
					</Link>{' '}
					before publishing recipes.
				</p>
			) : (
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault()
						const value = new FormData(event.currentTarget).get('visibility')

						if (
							value === 'private' ||
							value === 'unlisted' ||
							value === 'public'
						)
							update.mutate({ data: { recipeId, visibility: value } })
					}}
				>
					<fieldset key={visibility} className="space-y-3">
						<legend className="mb-3 text-sm font-semibold">
							{imported
								? 'on your public profile'
								: 'who can read this recipe?'}
						</legend>
						{(
							[
								['private', 'private', 'only you; no working sharing link'],
								[
									'unlisted',
									'anyone with the link',
									'hidden from your public profile and search engines',
								],
								[
									'public',
									'public',
									'listed on your profile; search engines may index it',
								],
							] as const
						).map(([value, label, description]) => (
							<label
								key={value}
								aria-label={label}
								htmlFor={`visibility-${value}`}
								className={cn(
									'flex cursor-pointer items-start gap-3 rounded-md border p-3',
									visibility === value
										? 'border-border bg-kitchen-yolk/20'
										: 'border-border',
								)}
							>
								<input
									type="radio"
									id={`visibility-${value}`}
									name="visibility"
									value={value}
									defaultChecked={visibility === value}
									className="accent-kitchen-basil mt-1 size-4 shrink-0"
								/>
								<span>
									<span className="block text-sm font-semibold">{label}</span>
									<span className="text-muted-foreground block text-sm">
										{description}
									</span>
								</span>
							</label>
						))}
					</fieldset>
					{imported ? (
						<p className="text-muted-foreground text-sm">
							this setting controls your profile listing and its link. the
							original shared web recipe remains available separately.
						</p>
					) : null}
					<button
						className={cn(primaryActionClassName, 'min-h-11')}
						type="submit"
						disabled={update.isPending}
					>
						{update.isPending ? 'saving…' : 'save visibility'}
					</button>
					{update.isError ? (
						<FieldError>{update.error.message}</FieldError>
					) : null}
					{update.isSuccess ? (
						<output className="text-sm">visibility saved</output>
					) : null}
					{path ? <ShareAddress path={path} onCopy={copy} /> : null}
				</form>
			)}
			{copied ? <output className="text-sm">link copied</output> : null}
			{copyError ? (
				<p role="alert" className="text-sm">
					couldn&apos;t copy — use the link above.
				</p>
			) : null}
		</div>
	)
}

function ShareAddress({
	path,
	onCopy,
}: {
	path: string
	onCopy: (value: string) => Promise<void>
}) {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<a href={path} className="min-w-0 text-sm break-all underline">
				{path}
			</a>
			<Button variant="outline" type="button" onClick={() => void onCopy(path)}>
				copy link
			</Button>
		</div>
	)
}
