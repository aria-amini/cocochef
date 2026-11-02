import { Dialog } from '@base-ui/react/dialog'
import { LinkSimpleIcon, XIcon } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
	FieldError,
	fieldClassName,
	placeholderClassName,
	primaryActionClassName,
} from '@/components/recipe-form'
import { asRecipeUrl, useRecipeImport } from '@/components/recipe-online'
import { importSiteLogo, importSites } from '@/lib/import/sites'
import { cn } from '@/lib/utils/ui'

// A link as people copy it, with or without its https://.
function linkFrom(value: string) {
	const trimmed = value.trim()

	return (
		asRecipeUrl(trimmed) ??
		(/^[\w-]+(\.[\w-]+)+\/\S*$/.test(trimmed)
			? `https://${trimmed}`
			: undefined)
	)
}

// Secondary to the search: paper with a field line that fills with card cream
// on hover, like the sidebar rows. As tall as the search.
const secondaryActionClassName =
	'border-input hover:bg-card focus-visible:outline-kitchen-eggplant inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm leading-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'

// The sites the importer is checked against, and most others.
function ImportSites() {
	return (
		<p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs font-semibold">
			<span aria-hidden className="flex items-center gap-1 opacity-80">
				{importSites.map((site) => (
					<img
						key={site.id}
						src={importSiteLogo(site.id)}
						alt=""
						title={site.name}
						className="size-3.5 rounded-sm"
					/>
				))}
			</span>
			<span className="sr-only">
				works with {importSites.map((site) => site.name).join(', ')} and most
				recipe sites
			</span>
			<span aria-hidden>&amp; most recipe sites</span>
		</p>
	)
}

// One field for a recipe's link: it is fetched, put on the shelf and opened.
export function ImportLinkForm({
	inputRef,
	defaultValue = '',
	onImported,
}: {
	// For a dialog to focus the field as it opens.
	inputRef?: React.Ref<HTMLInputElement> | undefined
	defaultValue?: string | undefined
	onImported?: () => void
}) {
	const id = useId()
	const navigate = useNavigate()
	const [value, setValue] = useState(defaultValue)
	const [invalid, setInvalid] = useState(false)

	const imported = useRecipeImport(async (recipe) => {
		toast.success(`${recipe.title} is on your shelf`)
		onImported?.()
		await navigate({
			to: '/recipes/$recipeId',
			params: { recipeId: recipe.id },
		})
	})

	const busy = imported.saving !== undefined

	const error = invalid
		? 'that doesn’t look like a link — copy it from the address bar'
		: imported.error

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault()
				const url = linkFrom(value)

				setInvalid(!url)

				if (url) void imported.save(url, { keep: true })
			}}
		>
			<label htmlFor={id} className="text-sm font-semibold">
				recipe link
			</label>
			<div className="flex gap-2">
				<input
					id={id}
					type="text"
					inputMode="url"
					autoComplete="off"
					ref={inputRef}
					value={value}
					maxLength={2000}
					disabled={busy}
					placeholder="https://…"
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setValue(event.target.value)
						setInvalid(false)
						imported.clearError()
					}}
					className={cn(
						fieldClassName,
						'min-w-0 flex-1 px-3 disabled:opacity-60',
						placeholderClassName,
					)}
				/>
				<button
					type="submit"
					disabled={busy || !value.trim()}
					className={cn(primaryActionClassName, 'px-4')}
				>
					import
				</button>
			</div>
			{busy ? (
				<p
					aria-live="polite"
					className="text-muted-foreground text-xs font-semibold"
				>
					grabbing the page — some sites make us knock twice
				</p>
			) : error ? (
				<FieldError id={`${id}-error`}>{error}</FieldError>
			) : (
				<ImportSites />
			)}
		</form>
	)
}

// The link field on its own, centered over the page.
export function ImportDialog({
	onImported,
	open,
	onOpenChange,
	defaultValue,
}: {
	onImported?: () => void
	open: boolean
	onOpenChange: (open: boolean) => void
	// A link carried over from the search.
	defaultValue?: string | undefined
}) {
	const field = useRef<HTMLInputElement>(null)

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
				<Dialog.Popup
					initialFocus={field}
					className="bg-background border-foreground/30 fixed top-[18%] left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-4 rounded-xl border p-5 shadow-md outline-none"
				>
					<div className="flex items-start justify-between gap-3">
						<Dialog.Title className="text-lg font-bold">
							import a recipe
						</Dialog.Title>
						<Dialog.Close
							aria-label="Close"
							className="text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant -m-1 grid size-8 place-items-center rounded-md focus-visible:outline-2"
						>
							<XIcon size={16} weight="bold" aria-hidden />
						</Dialog.Close>
					</div>
					<ImportLinkForm
						inputRef={field}
						defaultValue={defaultValue}
						onImported={() => {
							onOpenChange(false)
							onImported?.()
						}}
					/>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

// Beside the search on wider screens.
export function ImportLinkButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={secondaryActionClassName}
		>
			<LinkSimpleIcon size={16} weight="bold" aria-hidden />
			import link
		</button>
	)
}
