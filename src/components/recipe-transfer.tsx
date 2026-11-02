import { DownloadSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
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

// Saves one recipe as a file that another dutch-oven can import.
export function ExportRecipeButton({
	recipe,
}: {
	recipe: { id: string; title: string }
}) {
	const [pending, setPending] = useState(false)

	return (
		<button
			type="button"
			disabled={pending}
			onClick={() => {
				setPending(true)

				void downloadRecipes(recipe)
					.catch(() => toast.error("couldn't export that — try again"))
					.finally(() => setPending(false))
			}}
			className="text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant inline-flex items-center gap-1 px-1 py-1 text-xs font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
		>
			<DownloadSimpleIcon size={12} weight="bold" aria-hidden />
			export
		</button>
	)
}

// The whole shelf out as a file, and a file back in. This is how recipes move
// between kitchens that do not share a database, such as a preview and the
// live site, or a guest's browser and an account.
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

	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold">your recipes</h2>
			<p className="text-muted-foreground text-sm">
				move your recipes to another kitchen, like a new account or the live
				site, as a file. notes, books and ingredient groups come along; uploaded
				photos, cooking history and sharing don&apos;t.
			</p>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="outline"
					disabled={busy !== undefined}
					onClick={() => void exportAll()}
				>
					<DownloadSimpleIcon size={16} aria-hidden />
					{busy === 'export' ? 'exporting…' : 'export all recipes'}
				</Button>
				<label
					className={cn(
						buttonVariants({ variant: 'outline' }),
						'focus-within:ring-ring/50 cursor-pointer focus-within:ring-3',
						busy !== undefined && 'pointer-events-none opacity-50',
					)}
				>
					<UploadSimpleIcon size={16} aria-hidden />
					{busy === 'import' ? 'importing…' : 'import recipes'}
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
			</div>
			{result ? (
				<output
					className={result.failed ? 'text-destructive text-sm' : 'text-sm'}
					role={result.failed ? 'alert' : undefined}
				>
					{result.text}
				</output>
			) : null}
		</section>
	)
}
