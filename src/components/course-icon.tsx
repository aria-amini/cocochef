import {
	BirdIcon,
	BoneIcon,
	CakeIcon,
	CheeseIcon,
	CowIcon,
	EggIcon,
	FishIcon,
	LeafIcon,
	PlantIcon,
	PiggyBankIcon,
	ShrimpIcon,
	EggCrackIcon,
	ForkKnifeIcon,
	MartiniIcon,
	PopcornIcon,
} from '@phosphor-icons/react'

// Each kind of dish by a mark, in ink like the filters' own.
const courseIcons = new Map<string, (size: number) => React.ReactNode>([
	['entree', (size) => <ForkKnifeIcon size={size} {...markProps} />],
	['breakfast', (size) => <EggCrackIcon size={size} {...markProps} />],
	['dessert', (size) => <CakeIcon size={size} {...markProps} />],
	['drink', (size) => <MartiniIcon size={size} {...markProps} />],
	['snack', (size) => <PopcornIcon size={size} {...markProps} />],
])

const markProps = {
	weight: 'bold',
	'aria-hidden': true,
	className: 'shrink-0',
} as const

export function CourseIcon({
	course,
	size = 14,
}: {
	course: string
	size?: number
}) {
	return (courseIcons.get(course) ?? courseIcons.get('entree'))?.(size)
}

// Each protein by its animal or food, its cuts by theirs; pork has no pig in
// the set but a piggy bank.
const proteinIcons = new Map<string, (size: number) => React.ReactNode>([
	['fish', (size) => <FishIcon size={size} {...markProps} />],
	['shrimp', (size) => <ShrimpIcon size={size} {...markProps} />],
	['shellfish', (size) => <ShrimpIcon size={size} {...markProps} />],
	['beef', (size) => <CowIcon size={size} {...markProps} />],
	['chicken', (size) => <BirdIcon size={size} {...markProps} />],
	['pork', (size) => <PiggyBankIcon size={size} {...markProps} />],
	['vegetarian', (size) => <LeafIcon size={size} {...markProps} />],
	['egg', (size) => <EggIcon size={size} {...markProps} />],
	['dairy', (size) => <CheeseIcon size={size} {...markProps} />],
])

// A protein's mark, or its group's for a cut: thighs by chicken's.
export function ProteinIcon({
	protein,
	group,
	size = 14,
}: {
	protein: string
	group?: string | undefined
	size?: number
}) {
	const mark =
		proteinIcons.get(protein) ??
		(group ? proteinIcons.get(group) : undefined) ??
		((at: number) => <BoneIcon size={at} {...markProps} />)

	return mark(size)
}

// Meat-free by a leaf, and free of everything from an animal by a sprout.
export function DietIcon({
	diet,
	size,
}: {
	diet: 'vegetarian' | 'vegan'
	size: number
}) {
	return diet === 'vegan' ? (
		<PlantIcon size={size} {...markProps} />
	) : (
		<LeafIcon size={size} {...markProps} />
	)
}
