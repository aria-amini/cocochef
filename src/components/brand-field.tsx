import { Autocomplete } from '@base-ui/react/autocomplete'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { commonBrands } from '@/lib/pantry/brands'
import { findInPantry } from '@/lib/pantry/foods'
import { listBrands } from '@/lib/pantry/server'
import { cn } from '@/lib/utils/ui'

const brandsKey = ['brands'] as const

// The brand a cook buys, typed in their own words or picked from those
// offered for the food: the ones they have named for it first, then the
// common ones. Kept as the field is left, enter is pressed or a
// brand is picked; escape takes it back. Blank is no brand.
export function BrandField({
	food,
	brand,
	onBrand,
	className,
}: {
	// The food it is for, as the pantry or the list names it.
	food: string
	brand: string | null
	onBrand: (brand: string | null) => void
	className?: string
}) {
	const [draft, setDraft] = useState(brand ?? '')
	const cancelled = useRef(false)
	const kept = useRef(brand)

	const client = useQueryClient()

	const used = useQuery({
		queryKey: brandsKey,
		queryFn: () => listBrands(),
		staleTime: 60_000,
	}).data

	const offered = [
		...new Set([
			...(used ?? [])
				.filter((each) => findInPantry(each.text, [{ name: food }]))
				.map((each) => each.brand),
			...commonBrands(food),
		]),
	]

	function commit(value = draft) {
		if (cancelled.current) {
			cancelled.current = false

			return
		}

		const next = value.trim() || null

		if (next === kept.current) return

		kept.current = next
		onBrand(next)

		// Offered from now on, without waiting for the save.
		if (next)
			client.setQueryData<{ text: string; brand: string }[]>(
				brandsKey,
				(now = []) => [{ text: food, brand: next }, ...now],
			)
	}

	return (
		<Autocomplete.Root
			items={offered}
			value={draft}
			onValueChange={(value, details) => {
				setDraft(value)

				if (details.reason === 'item-press') commit(value)
			}}
			openOnInputClick
		>
			<Autocomplete.Input
				aria-label="brand"
				placeholder="brand"
				maxLength={60}
				onBlur={() => commit()}
				onKeyDown={(event) => {
					if (event.key === 'Enter') commit()

					if (event.key === 'Escape') {
						cancelled.current = true
						setDraft(brand ?? '')
					}
				}}
				className={cn(fieldClassName, placeholderClassName, className)}
			/>
			<Autocomplete.Portal>
				<Autocomplete.Positioner className="z-50" sideOffset={6}>
					<Autocomplete.Popup className="floating bg-background max-h-64 w-(--anchor-width) overflow-y-auto py-1 outline-none data-empty:hidden">
						<Autocomplete.List>
							{(item: string) => (
								<Autocomplete.Item
									key={item}
									value={item}
									className="data-highlighted:bg-kitchen-yolk/40 flex min-h-11 cursor-default items-center px-4 text-base outline-none select-none"
								>
									{item}
								</Autocomplete.Item>
							)}
						</Autocomplete.List>
					</Autocomplete.Popup>
				</Autocomplete.Positioner>
			</Autocomplete.Portal>
		</Autocomplete.Root>
	)
}

// A name with its brand after it, muted: "soy sauce · kikkoman".
export function WithBrand({
	name,
	brand,
}: {
	name: string
	brand: string | null
}) {
	return (
		<>
			{name}
			{brand ? <span className="text-muted-foreground"> · {brand}</span> : null}
		</>
	)
}
