import {
	AvocadoIcon,
	BirdIcon,
	BowlSteamIcon,
	BreadIcon,
	CakeIcon,
	CarrotIcon,
	CheeseIcon,
	CherriesIcon,
	CoffeeIcon,
	CookieIcon,
	CookingPotIcon,
	CowIcon,
	EggIcon,
	FireIcon,
	FishSimpleIcon,
	GrainsIcon,
	HamburgerIcon,
	IceCreamIcon,
	LeafIcon,
	OrangeSliceIcon,
	PepperIcon,
	PizzaIcon,
	PopcornIcon,
	ShrimpIcon,
	WineIcon,
	type Icon,
} from '@phosphor-icons/react'

// Words a recipe's name can hold, most telling first: "chicken noodle soup" is
// a soup before it is a chicken. Each matches whole words, plural or not.
const rules: [Icon, string[]][] = [
	[PizzaIcon, ['pizza', 'calzone', 'flatbread', 'focaccia']],
	[HamburgerIcon, ['burger', 'sandwich', 'sub', 'hoagie', 'slider', 'panini']],
	[
		BowlSteamIcon,
		[
			'soup',
			'stew',
			'chili',
			'chowder',
			'broth',
			'ramen',
			'pho',
			'curry',
			'dal',
		],
	],
	[IceCreamIcon, ['ice cream', 'gelato', 'sorbet', 'sundae', 'custard']],
	[
		CakeIcon,
		['cake', 'cupcake', 'cheesecake', 'brownie', 'torte', 'pie', 'tart'],
	],
	[CookieIcon, ['cookie', 'biscuit', 'scone', 'granola', 'shortbread']],
	[
		BreadIcon,
		[
			'bread',
			'toast',
			'bagel',
			'roll',
			'baguette',
			'muffin',
			'pancake',
			'waffle',
		],
	],
	[EggIcon, ['egg', 'omelet', 'omelette', 'frittata', 'quiche', 'shakshuka']],
	[ShrimpIcon, ['shrimp', 'prawn', 'crab', 'lobster', 'scallop']],
	[FishSimpleIcon, ['fish', 'salmon', 'tuna', 'cod', 'trout', 'sushi']],
	[BirdIcon, ['chicken', 'turkey', 'duck', 'wing']],
	[
		CowIcon,
		[
			'beef',
			'steak',
			'brisket',
			'meatball',
			'meatloaf',
			'pork',
			'ribs',
			'lamb',
		],
	],
	[PopcornIcon, ['popcorn', 'snack', 'nacho']],
	[CheeseIcon, ['cheese', 'mac', 'fondue', 'quesadilla']],
	[
		GrainsIcon,
		[
			'rice',
			'risotto',
			'pasta',
			'spaghetti',
			'noodle',
			'lasagna',
			'gnocchi',
			'oat',
		],
	],
	[AvocadoIcon, ['avocado', 'guacamole']],
	[LeafIcon, ['salad', 'slaw', 'greens', 'spinach', 'kale', 'pesto']],
	[CarrotIcon, ['carrot', 'veggie', 'vegetable']],
	[PepperIcon, ['pepper', 'salsa', 'spicy', 'taco', 'burrito', 'enchilada']],
	[CherriesIcon, ['berry', 'jam', 'cherry', 'smoothie', 'compote']],
	[OrangeSliceIcon, ['lemon', 'lime', 'orange', 'citrus']],
	[WineIcon, ['wine', 'sangria', 'cocktail', 'spritz']],
	[CoffeeIcon, ['coffee', 'latte', 'tea', 'espresso', 'cocoa']],
	[FireIcon, ['grilled', 'bbq', 'barbecue', 'smoked', 'roast']],
]

const matchers = rules.map(
	([icon, words]) =>
		[icon, new RegExp(String.raw`\b(?:${words.join('|')})(?:e?s)?\b`)] as const,
)

// What a recipe's name is about, to stand where its photo would be. A guess
// from the name alone: a name it knows nothing about gets a pot.
export function recipeIcon(title: string): Icon {
	const name = title.toLowerCase()

	return (
		matchers.find(([, matcher]) => matcher.test(name))?.[0] ?? CookingPotIcon
	)
}
