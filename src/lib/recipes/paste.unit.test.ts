import { describe, expect, test } from 'vite-plus/test'

import { isPastedRecipe, parsePastedRecipe, pastedIngredients } from './paste'

describe('parsePastedRecipe', () => {
	test('drops checkbox markers from a pasted checklist', () => {
		expect(
			parsePastedRecipe(`Soup
Ingredients
- [x] 1 onion
- [ ] 2 carrots
Method
1. Chop.`),
		).toEqual({
			title: 'Soup',
			ingredients: ['1 onion', '2 carrots'],
			steps: ['Chop.'],
		})
	})

	test('splits on ingredients and method headings', () => {
		expect(
			parsePastedRecipe(`Nonna's ragù

Ingredients
- 500g beef mince
- 1 onion
For the soffritto:
- 2 carrots

Method
1. Brown the mince.
2) Add the onion and cook until soft.`),
		).toEqual({
			title: "Nonna's ragù",
			ingredients: [
				'500g beef mince',
				'1 onion',
				'## For the soffritto',
				'2 carrots',
			],
			steps: ['Brown the mince.', 'Add the onion and cook until soft.'],
		})
	})

	test('sorts lines by shape when there are no headings', () => {
		expect(
			parsePastedRecipe(`weeknight dal
1 cup red lentils
1 tbsp ghee
salt
Rinse the lentils and simmer them in 3 cups of water for 20 minutes.
Stir in the ghee and season.`),
		).toEqual({
			title: 'weeknight dal',
			ingredients: ['1 cup red lentils', '1 tbsp ghee', 'salt'],
			steps: [
				'Rinse the lentils and simmer them in 3 cups of water for 20 minutes.',
				'Stir in the ghee and season.',
			],
		})
	})

	test('leaves the name empty when the paste starts with a heading', () => {
		expect(parsePastedRecipe('ingredients\n2 eggs\nsteps\nwhisk')).toEqual({
			title: '',
			ingredients: ['2 eggs'],
			steps: ['whisk'],
		})
	})

	test('clamps a long first line to the title limit', () => {
		expect(parsePastedRecipe(`${'a'.repeat(200)}\n2 eggs`).title).toHaveLength(
			120,
		)
	})
})

const ghormehSabzi = `Ghormeh Sabzi 🥬🥩

Equipment
Pots/Pans
- [x] Pot for braising (or Instant-pot)
- [x] Pot for rice (or Rice-cooker)
Other tools
- [x] Food processor
- [x] Salad spinner
- [x] Large Cutting board
- [x] Medium bowl to store meat
- [x] Small bowl to store onions + bench scraper
- [x] Kettle of water
Spices/Dry herbs
- [x] 1.5 tablespoons Dry leek
- [x] 1 teaspoon Dry Fenugreek
- [x] Turmeric, Garlic powder, black pepper

Groceries
Herbs
- [x] 1 small box of Spinach
- [x] 1 bunch Cilantro
- [x] 1 bunch Parsley
- [x] 3-6 stalks Green onion
Main Ingredients
- [ ] 2 Pound boneless short rib
- [x] 1 Yellow onion
- [x] 1/2 heaping cup dry beans with 1 tablespoon salt (10-15g) in 1L water. Alternative: 1 can.
Sides (Optional)
- [x] Sweet onion
- [x] Radish
- [x] Lime

Prep (Do ahead of time)
1. Soak beans
2. Soak rice
3. Prep meat
    1. Clean sink
    2. Cut meat
    3. Store cut meat in medium bowl
    4. Wash knife and cutting board
4. Prep herbs
    1. Cut stalks of herbs and wash (except spinach)
    2. Dry in salad spinner
    3. Store cilantro and parsley in mason charge and green onion and spinach in mesh bags

Instructions
1. Cook veggies
    1. Cut onion and store in small bowl
    2. Cut sweet onion and radish (optional)
    3. Run herbs through food processor
    4. Dump chopped herbs and dry leeks in cold sauté pan
    5. Cook with oil for 10 min
    6. Add fenugreek to end of sauté 
2. Start braise
    1. Sear meat
    2. Sauté onions
    3. Add spices (Turmeric, pepper, garlic powder)
    4. Add water
    5. Add cooked veggies
    6. Add beans
3. Cook for 2-4 hours (1-2 hours if using pressure cooker)
4. Add lime

Optional: Rice Instructions (Do 1 hour before braise is done)
1. Drain and rinse soaked rice in colander 
2. Cook rice in boiling water for ~5 minutes or until al dente
3. Drain and rinse rice in colander again
4. Take some rice and mix with yogurt 
5. Heat bowl on high and place yoghurt rice at bottom to form tadig for 1 minute
6. Set to low and put rest of rice in.
7. Cover with lid and paper towel and cook on low for 45 minutes`

describe('a recipe saved in a notes app', () => {
	const recipe = parsePastedRecipe(ghormehSabzi)

	test('names the recipe without its emoji', () => {
		expect(recipe.title).toBe('Ghormeh Sabzi')
	})

	test('keeps ingredient groups, drops checkboxes and moves measured items out of the equipment', () => {
		expect(recipe.ingredients).toEqual([
			'## Spices/Dry herbs',
			'1.5 tablespoons Dry leek',
			'1 teaspoon Dry Fenugreek',
			'Turmeric, Garlic powder, black pepper',
			'## Herbs',
			'1 small box of Spinach',
			'1 bunch Cilantro',
			'1 bunch Parsley',
			'3-6 stalks Green onion',
			'## Main Ingredients',
			'2 Pound boneless short rib',
			'1 Yellow onion',
			'1/2 heaping cup dry beans with 1 tablespoon salt (10-15g) in 1L water. Alternative: 1 can.',
			'## Sides (Optional)',
			'Sweet onion',
			'Radish',
			'Lime',
		])
	})

	test('keeps the numbered steps and nests their sub-steps', () => {
		expect(recipe.steps).toEqual([
			'Soak beans',
			'Soak rice',
			'Prep meat',
			'- Clean sink',
			'- Cut meat',
			'- Store cut meat in medium bowl',
			'- Wash knife and cutting board',
			'Prep herbs',
			'- Cut stalks of herbs and wash (except spinach)',
			'- Dry in salad spinner',
			'- Store cilantro and parsley in mason charge and green onion and spinach in mesh bags',
			'Cook veggies',
			'- Cut onion and store in small bowl',
			'- Cut sweet onion and radish (optional)',
			'- Run herbs through food processor',
			'- Dump chopped herbs and dry leeks in cold sauté pan',
			'- Cook with oil for 10 min',
			'- Add fenugreek to end of sauté',
			'Start braise',
			'- Sear meat',
			'- Sauté onions',
			'- Add spices (Turmeric, pepper, garlic powder)',
			'- Add water',
			'- Add cooked veggies',
			'- Add beans',
			'Cook for 2-4 hours (1-2 hours if using pressure cooker)',
			'Add lime',
			'Drain and rinse soaked rice in colander (optional)',
			'Cook rice in boiling water for ~5 minutes or until al dente (optional)',
			'Drain and rinse rice in colander again (optional)',
			'Take some rice and mix with yogurt (optional)',
			'Heat bowl on high and place yoghurt rice at bottom to form tadig for 1 minute (optional)',
			'Set to low and put rest of rice in. (optional)',
			'Cover with lid and paper towel and cook on low for 45 minutes (optional)',
		])
	})

	test('puts the equipment in the notes', () => {
		expect(recipe.notes).toBe(
			'Equipment: Pot for braising (or Instant-pot), Pot for rice (or Rice-cooker), Food processor, Salad spinner, Large Cutting board, Medium bowl to store meat, Small bowl to store onions + bench scraper, Kettle of water',
		)
	})
})

describe('what the sorter does not mistake', () => {
	test('keeps measured equipment groups in the order they were written', () => {
		expect(
			parsePastedRecipe(`Soup
Ingredients
1 onion
Equipment
Spices:
1 tsp cumin
Herbs:
2 tbsp parsley
Method
Boil`).ingredients,
		).toEqual([
			'## Spices',
			'1 tsp cumin',
			'## Herbs',
			'2 tbsp parsley',
			'1 onion',
		])
	})

	test('keeps a range in an ingredient line whole', () => {
		expect(
			parsePastedRecipe('Soup\nIngredients\n2 - 3 cloves garlic\nMethod\nBoil')
				.ingredients,
		).toEqual(['2 - 3 cloves garlic'])
	})

	test('reads "1.5 hours" and "1.5 cups" as amounts, not step numbers', () => {
		expect(
			parsePastedRecipe(`Stew
Ingredients
1.5 cups stock
Method
1. Simmer.
1.5 hours later, serve.`),
		).toEqual({
			title: 'Stew',
			ingredients: ['1.5 cups stock'],
			steps: ['Simmer.', '1.5 hours later, serve.'],
		})
	})

	test('marks the steps under an optional heading', () => {
		expect(
			parsePastedRecipe(`Rice
Instructions
1. Boil.
Optional: Tadig instructions
1. Fry the rice.`),
		).toEqual({
			title: 'Rice',
			ingredients: [],
			steps: ['Boil.', 'Fry the rice. (optional)'],
		})
	})

	test('nests a bulleted or numbered list indented under a step', () => {
		expect(
			parsePastedRecipe(`Soup
Instructions
1. Prep
  - Chop
  - Wash
2. Simmer`),
		).toEqual({
			title: 'Soup',
			ingredients: [],
			steps: ['Prep', '- Chop', '- Wash', 'Simmer'],
		})
	})
})

test('isPastedRecipe needs more than one line', () => {
	expect(isPastedRecipe('dal')).toBe(false)
	expect(isPastedRecipe('  dal\n')).toBe(false)
	expect(isPastedRecipe('dal\n1 cup lentils')).toBe(true)
})

test('pastedIngredients keeps group labels as sections and drops bullets', () => {
	expect(
		pastedIngredients('- 2 cups flour\n\nfor the topping:\n• 1 tbsp sugar\n'),
	).toEqual(['2 cups flour', '## for the topping', '1 tbsp sugar'])
})
