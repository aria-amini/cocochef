import { Menu } from '@base-ui/react/menu'
import {
	CaretUpDownIcon,
	SignInIcon,
	SignOutIcon,
	UserIcon,
	UserPlusIcon,
} from '@phosphor-icons/react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/avatar'
import { Badge } from '@/components/ui/badge'
import { authClient } from '@/lib/auth/client'
import { useAvatarUrl } from '@/lib/use-avatar-url'
import { useShelfStats } from '@/lib/use-shelf-stats'
import { cn } from '@/lib/utils/ui'

type Variant = 'rail' | 'avatar'

export const tabClassName =
	'focus-visible:outline-kitchen-eggplant flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold focus-visible:-outline-offset-2 focus-visible:outline-2'

// The sidebar row on wide screens; a small avatar button in the header on
// phones, where the account is a rare visit and not worth a tab.
const triggerClassNames: Record<Variant, string> = {
	rail: 'mt-auto flex w-full items-center gap-2.5 border px-2.5 py-2 text-xs font-semibold whitespace-nowrap rounded-md',
	avatar:
		'relative flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-1 text-sm font-semibold',
}

const interactiveClassName =
	'hover:bg-card hover:border-border focus-visible:outline-kitchen-eggplant focus-visible:outline-2 focus-visible:outline-offset-2 data-popup-open:bg-card data-popup-open:border-border data-popup-open:'

const itemClassName =
	'flex w-full cursor-default items-center gap-2.5 px-3 py-2.5 text-xs font-semibold outline-none select-none data-highlighted:bg-kitchen-yolk/40'

export function AccountMenu({ variant }: { variant: Variant }) {
	const session = authClient.useSession()
	const router = useRouter()
	const refetchSession = session.refetch

	useEffect(
		() =>
			router.subscribe('onResolved', () => {
				void refetchSession()
			}),
		[router, refetchSession],
	)

	const user = session.data?.user
	const avatarUrl = useAvatarUrl(user?.image)
	const stats = useShelfStats(user?.isAnonymous ? user.id : undefined)

	if (session.isPending) {
		return (
			<div
				aria-hidden
				className={cn(triggerClassNames[variant], 'border-transparent')}
			>
				<span
					className={cn(
						'bg-muted animate-pulse rounded-md',
						variant === 'avatar' ? 'size-8' : 'size-6',
					)}
				/>
				{variant === 'rail' ? (
					<span className="bg-muted h-3 w-16 animate-pulse rounded-md" />
				) : null}
			</div>
		)
	}

	if (!user) {
		return (
			<Link
				to="/auth/login"
				className={cn(
					triggerClassNames[variant],
					interactiveClassName,
					'border-transparent',
				)}
			>
				{variant === 'rail' ? <UserIcon size={18} aria-hidden /> : null}
				sign in
			</Link>
		)
	}

	if (user.isAnonymous) {
		const itemCount = stats ? stats.recipes + stats.pantryItems : 0

		return (
			<AccountMenuShell
				variant={variant}
				label="Guest account"
				trigger={
					<>
						<Avatar
							guest
							name="guest"
							size={variant === 'avatar' ? 'md' : 'sm'}
						/>
						{variant === 'rail' ? (
							<span className="min-w-0 flex-1 truncate text-left">guest</span>
						) : null}
						{itemCount > 0 ? (
							<span
								className={cn(
									'bg-foreground text-background rounded-md px-1 font-mono text-xs leading-4 font-semibold',
									variant === 'avatar' && 'absolute -top-0.5 -right-0.5',
								)}
							>
								{itemCount}
							</span>
						) : null}
					</>
				}
				triggerClassName="border-border border-dashed"
				header={
					<div className="flex items-center gap-3">
						<Avatar guest name="guest" size="lg" />
						<div className="min-w-0">
							<p className="text-sm font-bold">guest account</p>
							<p className="text-muted-foreground mt-1 text-xs font-semibold">
								create an account to save your recipes
							</p>
						</div>
					</div>
				}
			>
				<Menu.LinkItem
					className={cn(itemClassName, 'bg-kitchen-basil/30')}
					render={<Link to="/auth/signup" />}
				>
					<UserPlusIcon size={16} weight="bold" aria-hidden />
					create an account
					<Badge variant="tag" className="ml-auto">
						free
					</Badge>
				</Menu.LinkItem>
				<Menu.LinkItem
					className={itemClassName}
					render={<Link to="/auth/login" />}
				>
					<SignInIcon size={16} weight="bold" aria-hidden />
					sign in
				</Menu.LinkItem>
			</AccountMenuShell>
		)
	}

	return (
		<AccountMenuShell
			variant={variant}
			label="Account"
			trigger={
				<>
					<Avatar
						name={user.name}
						src={avatarUrl}
						size={variant === 'avatar' ? 'md' : 'sm'}
					/>
					{variant === 'rail' ? (
						<span className="min-w-0 flex-1 truncate text-left">
							{user.name}
						</span>
					) : null}
				</>
			}
			triggerClassName="border-transparent"
			header={
				<div className="flex items-center gap-3">
					<Avatar name={user.name} src={avatarUrl} size="lg" />
					<div className="min-w-0">
						<p className="truncate text-sm font-bold">{user.name}</p>
						<p className="text-muted-foreground mt-1 truncate text-xs font-semibold">
							{user.email}
						</p>
					</div>
				</div>
			}
		>
			<Menu.LinkItem className={itemClassName} render={<Link to="/profile" />}>
				<UserIcon size={16} weight="bold" aria-hidden />
				profile & photo
			</Menu.LinkItem>
			<SignOutItem />
		</AccountMenuShell>
	)
}

function AccountMenuShell({
	variant,
	label,
	trigger,
	triggerClassName: variantClassName,
	header,
	children,
}: {
	variant: Variant
	label: string
	trigger: ReactNode
	triggerClassName: string
	header: ReactNode
	children: ReactNode
}) {
	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={label}
				className={cn(
					triggerClassNames[variant],
					interactiveClassName,
					variantClassName,
				)}
			>
				{trigger}
				{variant === 'rail' ? (
					<CaretUpDownIcon size={14} weight="bold" aria-hidden />
				) : null}
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					className="z-50"
					align={variant === 'avatar' ? 'end' : 'start'}
					sideOffset={6}
				>
					<Menu.Popup className="bg-background border-foreground/30 w-64 overflow-hidden rounded-xl border shadow-md outline-none">
						<div className="border-border border-b px-3 py-3">{header}</div>
						<div className="flex flex-col py-1">{children}</div>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	)
}

function SignOutItem() {
	const navigate = useNavigate()
	const [signingOut, setSigningOut] = useState(false)

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
		<Menu.Item
			className={cn(itemClassName, 'data-disabled:opacity-50')}
			disabled={signingOut}
			onClick={() => void signOut()}
		>
			<SignOutIcon size={16} weight="bold" aria-hidden />
			{signingOut ? 'signing out…' : 'sign out'}
		</Menu.Item>
	)
}
