import {
	CaretDownIcon,
	DownloadSimpleIcon,
	UploadSimpleIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import {
	SettingsGroup,
	settingsActionClassName,
	settingsRowClassName,
} from '@/components/settings-group'
import { Button } from '@/components/ui/button'
import { exportRecipes, importRecipes } from '@/lib/recipes/server'
import { transferFilename } from '@/lib/recipes/transfer'
import { cn } from '@/lib/utils/ui'

// The largest file the server will read; checked first so a wrong pick fails
// at once instead of after a long upload.
const fileMax = 10_000_000

function download(text: string, filename: string) {
	const url = URL.createObjectURL(
		new Blob([text], { type: 'application/json' }),
	)

	const link = document.createElement('a')

	link.href = url
	link.download = filename
	document.body.append(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(url)
}

async function downloadRecipes(recipe?: { id: string; title: string }) {
	const file = await exportRecipes({ data: recipe ? { id: recipe.id } : {} })

	download(JSON.stringify(file, null, '\t'), transferFilename(recipe?.title))

	return file.recipes.length
}

// Saves one recipe as a file that another cocochef can import.
export function ExportRecipeButton({
	recipe,
}: {
	recipe: { id: string; title: string }
}) {
	const [pending, setPending] = useState(false)

	return (
		<Button
			variant="outline"
			disabled={pending}
			onClick={() => {
				setPending(true)

				void downloadRecipes(recipe)
					.catch(() => toast.error("couldn't export that — try again"))
					.finally(() => setPending(false))
			}}
		>
			<DownloadSimpleIcon size={14} weight="bold" aria-hidden />
			export as file
		</Button>
	)
}

// The whole shelf out as a file, and a file back in. This is how recipes move
// between kitchens that do not share a database, such as a preview and the
// live site.
export function RecipeTransfer() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [busy, setBusy] = useState<'export' | 'import'>()
	const [result, setResult] = useState<{ text: string; failed: boolean }>()

	const exportAll = async () => {
		setBusy('export')
		setResult(undefined)

		try {
			const count = await downloadRecipes()

			setResult({
				text: `exported ${count} ${count === 1 ? 'recipe' : 'recipes'}`,
				failed: false,
			})
		} catch {
			setResult({ text: "couldn't export — try again", failed: true })
		} finally {
			setBusy(undefined)
		}
	}

	const importFile = async (file: File) => {
		if (file.size > fileMax) {
			setResult({ text: 'that file is too big to import', failed: true })

			return
		}

		setBusy('import')
		setResult(undefined)

		try {
			const { imported, skipped } = await importRecipes({
				data: { text: await file.text() },
			})

			await Promise.all([
				router.invalidate(),
				queryClient.invalidateQueries({ queryKey: ['shelf'] }),
			])

			const added = `${imported} ${imported === 1 ? 'recipe' : 'recipes'} imported`

			setResult({
				text: skipped ? `${added}, ${skipped} already here` : added,
				failed: false,
			})
		} catch (error) {
			setResult({
				text:
					error instanceof Error && error.message
						? error.message
						: "couldn't import that file — try again",
				failed: true,
			})
		} finally {
			setBusy(undefined)
		}
	}

	// Rarely needed, so it waits folded at the foot of settings.
	return (
		<details className="group">
			<summary className="flex cursor-pointer list-none items-center gap-1.5 px-1 text-sm font-bold [&::-webkit-details-marker]:hidden">
				advanced
				<CaretDownIcon
					size={14}
					weight="bold"
					aria-hidden
					className="transition-transform group-open:rotate-180"
				/>
			</summary>
			<div className="mt-2">
				<SettingsGroup hint="a file of all your recipes, to bring into another account. photos and cooking history stay behind.">
					<button
						type="button"
						disabled={busy !== undefined}
						onClick={() => void exportAll()}
						className={settingsActionClassName}
					>
						<span className="flex-1">
							{busy === 'export' ? 'exporting…' : 'export all recipes'}
						</span>
						<DownloadSimpleIcon size={16} weight="bold" aria-hidden />
					</button>
					<label
						className={cn(
							settingsActionClassName,
							'focus-within:bg-kitchen-yolk/20',
							busy !== undefined && 'pointer-events-none opacity-50',
						)}
					>
						<span className="flex-1">
							{busy === 'import' ? 'importing…' : 'import recipes'}
						</span>
						<UploadSimpleIcon size={16} weight="bold" aria-hidden />
						<input
							type="file"
							accept="application/json,.json"
							aria-label="recipe file"
							disabled={busy !== undefined}
							className="sr-only"
							onChange={(event) => {
								const file = event.target.files?.[0]

								event.target.value = ''

								if (file) void importFile(file)
							}}
						/>
					</label>
					{result ? (
						<output
							className={cn(
								settingsRowClassName,
								'text-sm',
								result.failed && 'font-semibold',
							)}
							role={result.failed ? 'alert' : undefined}
						>
							{result.text}
						</output>
					) : null}
				</SettingsGroup>
			</div>
		</details>
	)
}
