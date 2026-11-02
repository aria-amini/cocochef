// A culinary family is more precise than a shopping category: fish and meat
// share one pantry category, while fresh and dried herbs may live apart.
const families = [
	{
		id: 'herb',
		category: 'vegetables',
		names: [
			'mint',
			'parsley',
			'cilantro',
			'coriander leaves',
			'basil',
			'thyme',
			'rosemary',
			'oregano',
			'sage',
			'dill',
			'tarragon',
			'chives',
			'bay leaf',
			'bay leaves',
			'herb',
			'herbs',
		],
	},
	{
		id: 'fish',
		category: 'meat',
		names: [
			'fish',
			'seafood',
			'cod',
			'haddock',
			'pollock',
			'herring',
			'sardine',
			'sardines',
			'anchovy',
			'anchovies',
			'trout',
			'tuna',
			'halibut',
			'shrimp',
			'prawns',
			'crab',
			'lobster',
			'scallops',
			'mussels',
			'clams',
		],
	},
	{
		id: 'meat',
		category: 'meat',
		names: [
			'meat',
			'poultry',
			'duck',
			'turkey',
			'goose',
			'venison',
			'rabbit',
			'veal',
		],
	},
	{
		id: 'seed',
		category: 'grains',
		names: ['seed', 'seeds', 'chia', 'flax', 'linseed', 'hemp', 'sesame'],
	},
	{
		id: 'grain',
		category: 'grains',
		names: [
			'grain',
			'grains',
			'buckwheat',
			'amaranth',
			'millet',
			'sorghum',
			'teff',
		],
	},
] as const

export function foodFamily(name: string) {
	const text = ` ${name.toLowerCase().replace(/[^\p{L}]+/gu, ' ')} `

	return families.find(({ names }) =>
		names.some((word) => text.includes(` ${word} `)),
	)
}
