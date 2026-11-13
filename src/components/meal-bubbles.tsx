import { Checkbox } from '@base-ui/react/checkbox'
import { Popover } from '@base-ui/react/popover'
import {
	BoneIcon,
	GlobeHemisphereWestIcon,
	CaretRightIcon,
	CheckIcon,
	FunnelSimpleIcon,
	MinusIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'

import { PantrySprite } from '@/components/pantry-sprite'
import type { PartCount } from '@/lib/assistant/meal-parts'
import { cn } from '@/lib/utils/ui'

// The parts of a meal, as bubbles in the order Chlebowski picks them. A
// flavor still names its cuisine in the tags, but is not a bubble of its own.
export const partBubbles = [
	{ key: 'cuisine', label: 'country', counts: 'cuisines', within: 'countries' },
	{ key: 'protein', label: 'protein', counts: 'proteins', within: 'cuts' },
] as const

// Each bubble's mark, beside its name, in ink so it never outshouts the
// food: the world for a country, a bone for protein.
export const partGlyphs: Record<
	(typeof partBubbles)[number]['key'],
	React.ReactNode
> = {
	cuisine: <GlobeHemisphereWestIcon size={14} weight="bold" aria-hidden />,
	protein: <BoneIcon size={14} weight="bold" aria-hidden />,
}

const chipClassName =
	'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors'

const unsetChipClassName =
	'border-input text-muted-foreground hover:text-foreground border border-dashed'

// A country's flag, by its code. Drawn, not emoji, since most computers have
// no flag emoji and show the country's letters instead.
const flagClassName = 'border-foreground/15 h-3.5 w-5 border'

// Each flag is its own file, fetched only when its row shows. Without
// no-inline, Vite would inline every small SVG as a data URL, and all 250
// flags would ride in this chunk.
const flagFiles = new Map(
	Object.entries(
		import.meta.glob<string>('/node_modules/country-flag-icons/3x2/*.svg', {
			query: '?url&no-inline',
			import: 'default',
			eager: true,
		}),
	).map(([path, url]) => [path.replace(/^.*\/|\.svg$/g, ''), url]),
)

export function Flag({ code }: { code: string }) {
	const url = flagFiles.get(code)

	return url ? <img src={url} alt="" className={flagClassName} /> : null
}

// What a bubble with picks says: the one picked, or the first and how many
// more.
const pickedLabel = (value: readonly string[]) =>
	value.length > 1 ? `${value[0]} +${value.length - 1}` : value[0]

// One kind of filter: its name and mark, what is picked, and what can be.
export type FilterGroup = {
	key: string
	label: string
	glyph: React.ReactNode
	value: readonly string[]
	options: PartCount[] | undefined
	onPick: (names: string[]) => void
	icon?: ((name: string) => React.ReactNode) | undefined
	// What each top choice of a tree holds, to name its caret.
	within?: string
}

// Every filter behind one button: the kinds down the left, the one chosen's
// boxes to tick on the right, each tick applied as it lands. Countries and
// proteins come as trees.
export function FilterPanel({
	groups,
	open,
	onOpenChange,
	active,
	onActive,
}: {
	groups: readonly FilterGroup[]
	open: boolean
	onOpenChange: (open: boolean) => void
	active: string
	onActive: (key: string) => void
}) {
	const shown = groups.find((group) => group.key === active) ?? groups[0]
	// Opening, focus lands on the kind being shown, not the first.
	const current = useRef<HTMLButtonElement>(null)
	const picked = groups.reduce((total, group) => total + group.value.length, 0)

	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Trigger className={cn(chipClassName, unsetChipClassName)}>
				<FunnelSimpleIcon size={14} weight="bold" aria-hidden />
				filter
				{picked ? (
					<span className="bg-foreground text-background grid min-w-5 place-items-center rounded-full px-1 text-xs tabular-nums">
						{picked}
					</span>
				) : null}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner
					className="z-50"
					side="bottom"
					align="start"
					sideOffset={6}
					collisionPadding={16}
				>
					<Popover.Popup
						aria-label="filters"
						initialFocus={current}
						className="floating bg-background flex h-[min(28rem,70dvh)] w-[min(34rem,calc(100vw-2rem))] overflow-hidden outline-none"
					>
						<nav
							aria-label="kinds of filter"
							className="border-border flex w-28 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-1.5 md:w-32"
						>
							{groups.map((group) => (
								<button
									key={group.key}
									ref={group.key === shown?.key ? current : undefined}
									type="button"
									aria-current={group.key === shown?.key ? 'true' : undefined}
									onClick={() => onActive(group.key)}
									className={cn(
										'flex min-h-10 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold transition-colors',
										group.key === shown?.key
											? 'bg-kitchen-yolk/45'
											: 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
									)}
								>
									{group.glyph}
									<span className="min-w-0 flex-1 truncate">{group.label}</span>
									{group.value.length ? (
										<span className="text-xs tabular-nums">
											{group.value.length}
										</span>
									) : null}
								</button>
							))}
						</nav>
						<section
							aria-label={shown?.label}
							className="flex min-w-0 flex-1 flex-col"
						>
							{shown ? <PickOptions key={shown.key} group={shown} /> : null}
						</section>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	)
}

// A filter in use, in the row: what is picked, opening the panel at its kind,
// and a cross to take it off.
export function ActiveFilter({
	group,
	onOpen,
}: {
	group: FilterGroup
	onOpen: () => void
}) {
	return (
		<span className="bg-kitchen-eggplant/10 text-kitchen-eggplant inline-flex items-center rounded-full">
			<button
				type="button"
				aria-label={`${group.label}: ${group.value.join(', ')}`}
				onClick={onOpen}
				className={cn(chipClassName, 'hover:bg-kitchen-eggplant/20 pr-1.5')}
			>
				{group.glyph}
				{pickedLabel(group.value)}
			</button>
			<button
				type="button"
				aria-label={`clear ${group.label}`}
				onClick={() => group.onPick([])}
				className="hover:bg-kitchen-eggplant/20 mr-1 grid size-7 place-items-center rounded-full"
			>
				<XIcon size={12} weight="bold" aria-hidden />
			</button>
		</span>
	)
}

// One kind's boxes to tick: a tree when it has one, else a list.
function PickOptions({ group }: { group: FilterGroup }) {
	const { value, options, onPick, icon, within = 'kinds' } = group
	const tree = options?.some((option) => option.region) ?? false

	if (!options?.length)
		return (
			<p className="text-muted-foreground px-3 py-2.5 text-sm">
				nothing left with these filters
			</p>
		)

	if (tree)
		return (
			<PickTree
				value={value}
				options={options}
				onPick={onPick}
				within={within}
				icon={icon}
				searchable={within === 'countries'}
			/>
		)

	return (
		<div className={pickListClassName}>
			{options.map((option) => (
				<PickRow
					key={option.name}
					name={option.name}
					checked={value.includes(option.name)}
					empty={option.count === 0}
					onToggle={() =>
						onPick(
							value.includes(option.name)
								? value.filter((name) => name !== option.name)
								: [...value, option.name],
						)
					}
				>
					{icon ? (
						icon(option.name)
					) : (
						<PantrySprite look={{ key: option.sprite }} className="size-5" />
					)}
				</PickRow>
			))}
		</div>
	)
}

// Regions, each ticked whole or opened to its countries. Ticking a region
// takes all of it; taking one country off a whole region keeps the rest;
// ticking every country listed makes the region whole again. A searchable
// tree has a box to find one by name, and the most found first, for a quick
// pick.
function PickTree({
	value,
	options,
	onPick,
	within,
	icon,
	searchable = false,
}: {
	value: readonly string[]
	options: PartCount[]
	onPick: (names: string[]) => void
	// A mark for a choice that has no flag: a protein's animal.
	icon?: ((name: string) => React.ReactNode) | undefined
	// What each top choice holds, to name its caret: "countries", "cuts".
	within: string
	searchable?: boolean
}) {
	const [open, setOpen] = useState<ReadonlySet<string>>(
		() =>
			new Set(
				options.flatMap((option) =>
					option.region && value.includes(option.name) ? [option.region] : [],
				),
			),
	)

	const [query, setQuery] = useState('')
	const words = query.trim().toLowerCase()
	const matches = (name: string) => name.toLowerCase().includes(words)

	const childrenOf = (top: string) =>
		options.filter(({ region }) => region === top)

	// Picks or drops one child, keeping its region whole or not as it should.
	function toggleChild(child: PartCount) {
		const top = child.region ?? ''
		const names = new Set(childrenOf(top).map(({ name }) => name))
		const whole = value.includes(top)
		const others = value.filter((name) => name !== top && !names.has(name))

		if (whole) {
			onPick([...others, ...[...names].filter((name) => name !== child.name)])

			return
		}

		const mine = value.filter((name) => names.has(name))

		const next = mine.includes(child.name)
			? mine.filter((name) => name !== child.name)
			: [...mine, child.name]

		onPick(next.length === names.size ? [...others, top] : [...others, ...next])
	}

	const childRow = (child: PartCount, indent: boolean) => (
		<TreeRow key={child.name}>
			<PickRow
				name={child.name}
				checked={
					value.includes(child.name) ||
					(child.region !== undefined && value.includes(child.region))
				}
				empty={child.count === 0}
				onToggle={() => toggleChild(child)}
				indent={indent}
			>
				{/* A country shows its flag; a cut leaves the mark to its protein
			    above it. */}
				{child.flag ? <Flag code={child.flag} /> : null}
			</PickRow>
		</TreeRow>
	)

	const popular = options
		.filter((option) => option.region && option.count > 0)
		.sort((a, b) => b.count - a.count)
		.slice(0, 6)

	const regions = options.filter(
		(option) =>
			!option.region &&
			(!words ||
				matches(option.name) ||
				childrenOf(option.name).some(({ name }) => matches(name))),
	)

	return (
		<>
			{searchable ? (
				<div className="border-border shrink-0 border-b p-2">
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={`find a ${within === 'countries' ? 'country' : 'kind'}`}
						aria-label={`find a ${within === 'countries' ? 'country' : 'kind'}`}
						className="border-input bg-card w-full rounded-md border px-3 py-2 text-sm font-semibold outline-none"
					/>
				</div>
			) : null}
			<div className={pickListClassName}>
				{searchable && !words && popular.length ? (
					<div className="border-border mb-1 border-b pb-1">
						<p className="text-muted-foreground px-3 pt-1 pb-0.5 text-xs font-bold">
							popular
						</p>
						{popular.map((child) => childRow(child, false))}
					</div>
				) : null}
				{regions.map((region) => {
					const countries = childrenOf(region.name).filter(
						({ name }) => !words || matches(region.name) || matches(name),
					)

					const names = new Set(childrenOf(region.name).map(({ name }) => name))

					const whole = value.includes(region.name)
					const some = !whole && value.some((name) => names.has(name))

					const others = value.filter(
						(name) => name !== region.name && !names.has(name),
					)

					// Searching opens every region with a match inside.
					const expanded =
						open.has(region.name) ||
						(Boolean(words) && countries.length > 0 && !matches(region.name))

					return (
						<div key={region.name}>
							<TreeRow
								caret={
									countries.length ? (
										<button
											type="button"
											aria-label={`${expanded ? 'hide' : 'show'} ${region.name} ${within}`}
											aria-expanded={expanded}
											onClick={() =>
												setOpen((now) => {
													const next = new Set(now)

													if (expanded) next.delete(region.name)
													else next.add(region.name)

													return next
												})
											}
											className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-8 shrink-0 place-items-center rounded-md"
										>
											<CaretRightIcon
												size={12}
												weight="bold"
												aria-hidden
												className={cn(
													'transition-transform',
													expanded && 'rotate-90',
												)}
											/>
										</button>
									) : undefined
								}
							>
								<PickRow
									name={region.name}
									checked={whole}
									mixed={some}
									empty={region.count === 0}
									onToggle={() =>
										onPick(whole || some ? others : [...others, region.name])
									}
								>
									{icon?.(region.name)}
								</PickRow>
							</TreeRow>
							{expanded
								? countries.map((child) => childRow(child, true))
								: null}
						</div>
					)
				})}
				{words && !regions.length ? (
					<p className="text-muted-foreground px-3 py-2.5 text-sm">
						no {within} by that name
					</p>
				) : null}
			</div>
		</>
	)
}

// The rows of a pick popup, scrolling under its search box rather than
// beside it, with a bar that keeps its own strip.
const pickListClassName =
	'scrollbar-visible min-h-0 flex-1 overflow-y-auto py-1'

// A row of a tree: its open-and-close caret at the left, or the caret's
// room left blank, so every box in the tree lines up.
function TreeRow({
	caret,
	children,
}: {
	caret?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<div className="flex items-center pl-1">
			{caret ?? <span aria-hidden className="size-8 shrink-0" />}
			{children}
		</div>
	)
}

// One choice with a box to tick, its mark, and its name.
function PickRow({
	name,
	checked,
	mixed = false,
	empty = false,
	onToggle,
	indent = false,
	children,
}: {
	name: string
	checked: boolean
	mixed?: boolean
	// Nothing in the list has it: shown greyed, and not to be picked, unless
	// it is picked already and needs taking off.
	empty?: boolean
	onToggle: () => void
	indent?: boolean
	children?: React.ReactNode
}) {
	const off = empty && !checked && !mixed

	return (
		<Checkbox.Root
			checked={checked}
			indeterminate={mixed}
			disabled={off}
			onCheckedChange={onToggle}
			className={cn(
				'flex min-h-10 w-full min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm font-semibold',
				off
					? 'text-muted-foreground/60 cursor-not-allowed'
					: 'hover:bg-kitchen-yolk/40',
				indent ? 'pl-9' : 'pl-2',
			)}
		>
			<span
				aria-hidden
				className={cn(
					'grid size-4.5 shrink-0 place-items-center rounded-md border',
					checked || mixed
						? 'bg-foreground border-foreground text-background'
						: 'border-input',
				)}
			>
				<Checkbox.Indicator>
					{mixed ? (
						<MinusIcon size={10} weight="bold" />
					) : (
						<CheckIcon size={10} weight="bold" />
					)}
				</Checkbox.Indicator>
			</span>
			{children ? (
				<span aria-hidden className="grid size-5 shrink-0 place-items-center">
					{children}
				</span>
			) : null}
			<span className="min-w-0 flex-1 truncate">{name}</span>
		</Checkbox.Root>
	)
}
