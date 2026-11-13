import {
	SnowflakeIcon,
	ThermometerColdIcon,
	ThermometerHotIcon,
} from '@phosphor-icons/react'

import { CourseIcon, DietIcon, ProteinIcon } from '@/components/course-icon'
import { Flag } from '@/components/meal-bubbles'
import {
	coursesOf,
	cuisineTag,
	type MealTags,
	proteinGroupOf,
	proteinTag,
	temperatureOf,
} from '@/lib/assistant/meal-parts'
import { cn } from '@/lib/utils/ui'

const tagClassName =
	'bg-muted inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 md:gap-1.5 md:px-2.5'

const temperatureMarks = new Map([
	[
		'frozen',
		<SnowflakeIcon key="frozen" size={12} weight="bold" aria-hidden />,
	],
	[
		'cool',
		<ThermometerColdIcon key="cool" size={12} weight="bold" aria-hidden />,
	],
	[
		'warm',
		<ThermometerHotIcon key="warm" size={12} weight="bold" aria-hidden />,
	],
])

// A recipe's kind at a glance, as small tags, the same in a list and on its
// page: where it is from, as closely as known (a country with its flag, or a
// region alone); what kind of dish it is, unless it is the usual entree; how
// it is eaten, where there is room; what it is built on; and whether it is
// vegan, or meat-free unless what it is built on says so already.
export function RecipeTags({
	title,
	tags,
	vegetarian,
	vegan = false,
	withTemperature = false,
	oneLine = false,
	className,
}: {
	title: string
	tags: MealTags | null | undefined
	vegetarian: boolean
	vegan?: boolean | undefined
	withTemperature?: boolean
	// On a phone's row, the two tags that say the most, on one line.
	oneLine?: boolean
	className?: string | undefined
}) {
	const place = cuisineTag(tags?.cuisines ?? [])
	const protein = proteinTag(tags?.proteins ?? [])
	const temperature = withTemperature ? temperatureOf(title) : undefined

	const diet = vegan
		? 'vegan'
		: vegetarian && !tags?.proteins.includes('vegetarian')
			? 'vegetarian'
			: undefined

	// Each tag in the order it reads, ranked by how much it tells apart: what
	// one can or can't eat, then what it is built on, then where it is from.
	const shown: { key: string; rank: number; node: React.ReactNode }[] = [
		...(place
			? [
					{
						key: 'place',
						rank: 2,
						node: (
							<>
								{place.flag ? <Flag code={place.flag} /> : null}
								{place.name}
							</>
						),
					},
				]
			: []),
		...coursesOf(title)
			.filter((course) => course !== 'entree')
			.map((course) => ({
				key: course,
				rank: 3,
				node: (
					<>
						<CourseIcon course={course} size={12} />
						{course}
					</>
				),
			})),
		...(temperature
			? [
					{
						key: 'temperature',
						rank: 4,
						node: (
							<>
								{temperatureMarks.get(temperature)}
								{temperature}
							</>
						),
					},
				]
			: []),
		...(protein
			? [
					{
						key: 'protein',
						rank: 1,
						node: (
							<>
								<ProteinIcon
									protein={protein}
									group={proteinGroupOf(protein)}
									size={12}
								/>
								{protein}
							</>
						),
					},
				]
			: []),
		...(diet
			? [
					{
						key: 'diet',
						rank: 0,
						node: (
							<>
								<DietIcon diet={diet} size={12} />
								{diet}
							</>
						),
					},
				]
			: []),
	]

	// The two that say the most stay on a phone's row; the rest wait for room.
	const kept = new Set(
		[...shown]
			.sort((a, b) => a.rank - b.rank)
			.slice(0, 2)
			.map(({ key }) => key),
	)

	return (
		<span
			className={cn(
				'flex gap-1 text-xs font-semibold lowercase md:gap-1.5 md:text-sm',
				oneLine ? 'overflow-hidden md:flex-wrap' : 'flex-wrap',
				className,
			)}
		>
			{shown.map(({ key, node }) => (
				<span
					key={key}
					className={cn(
						tagClassName,
						oneLine && !kept.has(key) && 'hidden md:inline-flex',
					)}
				>
					{node}
				</span>
			))}
		</span>
	)
}
