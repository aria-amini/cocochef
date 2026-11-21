import { CheckIcon } from '@phosphor-icons/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ItemSheet } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { SheetHead } from '@/components/recipe-ready'
import type { RecipeShop } from '@/components/recipe-shop'
import { Button } from '@/components/ui/button'
import { undoToast } from '@/components/undo-toast'
import { usePlan, usePlanWrites } from '@/components/use-plans'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

type Fresh = {
	id: string
	name: string
	line: string
}

// The end of a cook, wherever it's said: the recipe comes off what's in
// progress, and the fresh food it was bought for is asked about, since
// only the cook knows if any is left.
export function useCookDone(recipeId: string, shop: RecipeShop) {
	const [asking, setAsking] = useState(false)
	const plans = usePlanWrites()

	// Fresh food home that a meal is bought for, once each: what cooking
	// most likely used up. What a kitchen keeps on hand isn't asked about.
	const fresh = [
		...new Map(
			shop.rows.flatMap((row) =>
				row.home && row.item?.spoils && !row.item.staple
					? [
							[
								row.item.id,
								{ id: row.item.id, name: row.item.name, line: row.line },
							] as const,
						]
					: [],
			),
		).values(),
	]

	async function finish(usedUp: readonly Fresh[]) {
		setAsking(false)

		try {
			const done = await plans.finish(
				recipeId,
				usedUp.map((food) => food.id),
			)

			const message = usedUp.length
				? `cooked · ${usedUp.length === 1 ? usedUp[0]?.name : `${usedUp.length} foods`} used up`
				: 'cooked'

			if (done)
				undoToast(
					message,
					() =>
						void plans.unfinish(recipeId, done).catch(() => {
							toast.error("couldn't undo that — try again")
						}),
					'recipe-cook',
				)
		} catch {
			toast.error("couldn't save that — try again")
		}
	}

	// With nothing fresh to ask about, it's just done.
	function start() {
		if (fresh.length) setAsking(true)
		else void finish([])
	}

	return {
		fresh,
		start,
		asking,
		stopAsking: () => setAsking(false),
		finish,
	}
}

// The steps' end on the recipe page: done cooking, while it's in progress.
// Every step ticked asks too.
export function DoneCooking({
	recipeId,
	shop,
	stepsDone,
}: {
	recipeId: string
	shop: RecipeShop
	stepsDone: boolean
}) {
	const button = useRef<HTMLButtonElement>(null)
	const plan = usePlan(recipeId, shop.signedIn)
	const done = useCookDone(recipeId, shop)
	const inProgress = !!plan.data

	// Every step ticked is the cook done, most likely: asked, not assumed.
	const askCooked = useEffectEvent(() => {
		if (!inProgress && !done.fresh.length) return

		toast('cooked it?', {
			id: 'cooked-it',
			position: 'bottom-center',
			duration: 10_000,
			action: { label: 'yes', onClick: done.start },
			cancel: { label: 'not yet', onClick: () => undefined },
		})
	})

	useEffect(() => {
		if (stepsDone) askCooked()
	}, [stepsDone])

	return (
		<>
			{inProgress ? (
				<Button
					ref={button}
					variant="outline"
					onClick={done.start}
					className="mt-4 min-h-11 w-full"
				>
					<CheckIcon weight="bold" aria-hidden className="text-kitchen-basil" />
					done cooking
				</Button>
			) : null}
			{done.asking ? (
				<AnyLeft
					anchor={() => button.current}
					fresh={done.fresh}
					onClose={done.stopAsking}
					onDone={(usedUp) => void done.finish(usedUp)}
				/>
			) : null}
		</>
	)
}

// Each fresh food, used up or with some left. Used up is the likelier, so
// it's what each starts at.
export function AnyLeft({
	anchor,
	fresh,
	onClose,
	onDone,
}: {
	anchor: () => Element | null
	fresh: readonly Fresh[]
	onClose: () => void
	onDone: (usedUp: readonly Fresh[]) => void
}) {
	// The foods with some left, by pantry item; the rest were used up.
	const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set())

	return (
		<ItemSheet anchor={anchor} title="any left?" wide onClose={onClose}>
			<SheetHead>any left?</SheetHead>
			<ul className="flex flex-col">
				{fresh.map((food) => {
					const look = ingredientItemLook(food.line)
					const some = left.has(food.id)

					return (
						<li key={food.id} className="flex min-h-13 items-center gap-3 py-1">
							<span
								aria-hidden
								className="grid size-6 shrink-0 place-items-center"
							>
								{look ? <PantrySprite look={look} className="size-6" /> : null}
							</span>
							<span className="min-w-0 flex-1 text-base wrap-break-word">
								{food.name}
							</span>
							<fieldset className="border-input grid shrink-0 grid-cols-2 overflow-hidden rounded-md border">
								<legend className="sr-only">any {food.name} left?</legend>
								{(
									[
										{ some: false, label: 'used it' },
										{ some: true, label: 'some left' },
									] as const
								).map((option) => (
									<button
										key={option.label}
										type="button"
										aria-pressed={some === option.some}
										onClick={() =>
											setLeft((now) => {
												const next = new Set(now)

												if (option.some) next.add(food.id)
												else next.delete(food.id)

												return next
											})
										}
										className={cn(
											'border-input flex min-h-9 items-center justify-center px-3 text-sm font-semibold whitespace-nowrap transition-colors not-first:border-l',
											some === option.some
												? 'bg-kitchen-yolk/30'
												: 'hover:bg-muted/60',
										)}
									>
										{option.label}
									</button>
								))}
							</fieldset>
						</li>
					)
				})}
			</ul>
			<Button
				onClick={() => onDone(fresh.filter((food) => !left.has(food.id)))}
				className="w-full"
			>
				done cooking
			</Button>
		</ItemSheet>
	)
}
