import { describe, expect, test } from 'vite-plus/test'

import {
	ingredientItemLook,
	ingredientItemSprite,
	resolveSpriteLook,
	resolveSpriteSrc,
} from './sprites'

describe('ingredient sprites', () => {
	test.each([
		['2 yellow onions, diced', 'onion'],
		['1 large egg', 'egg'],
		['400g plum tomatoes', 'tomato'],
		['2 potatoes', 'potato'],
		['cherries', 'cherry'],
		['2 tbsp chopped parsley', 'herb-bunch'],
		['handful chopped coriander to serve', 'herb-bunch'],
		['1 tsp ground coriander', 'shaker-jar'],
		['1 tsp garlic powder', 'shaker-jar-squat'],
		['1 tsp yellow mustard seed', 'cork-jar'],
		['1 chicken stock cube', 'packet'],
		['2 tbsp fish sauce', 'soy-dasher'],
		['1 tbsp coconut oil', 'mason-jar'],
		['250g Greek yogurt', 'tub'],
		['1 pork shoulder', 'meat'],
		['2 duck breasts', 'meat'],
		['2 turkey thighs', 'meat'],
		['200g green beans', 'green-beans'],
		['1 tsp dried thyme', 'shaker-jar'],
		['1 tbsp almond butter', 'mason-jar'],
		['200g prawns', 'shrimp'],
		['150g red lentils', 'window-pouch'],
		['1cm fresh ginger', 'ginger'],
		['25g toasted breadcrumbs', 'bread'],
		['1 tbsp brown sugar', 'sack'],
		['1 tbsp butter', 'butter'],
		['2 tbsp sultanas', 'grapes'],
		['2 pork sausages', 'sausage'],
		['1 package turkey bacon', 'bacon'],
		['2 beef steaks', 'steak'],
		['2 lb beef brisket', 'steak'],
		['1 pork shoulder', 'meat'],
		['1 cup water', 'tumbler'],
		['1 cup warm water', 'tumbler'],
		['1 cup milk or water', 'milk'],
		['1 cup coconut water', 'tumbler'],
		['2 tbsp rose water', undefined],
		['1 water chestnut', undefined],
		['3 green onions', 'onion'],
		['1 cup green olives', 'olives'],
		['2 cups mixed greens', 'lettuce'],
		['a mystery ingredient', undefined],
		['', undefined],
		['## herbs', undefined],
		['500g beef mince', 'meat'],
		['1 lime', 'lime'],
		['raspberries', 'strawberry'],
		['coconut milk', 'tin-can'],
		['egg noodles', 'wheat'],
		['freshly ground pepper', 'black-pepper'],
		['1 tsp pepper', 'black-pepper'],
		['1 red bell pepper, sliced', 'bell-pepper'],
		['½ tsp crushed red pepper', 'chili-pepper'],
		['1 tbsp ghee', 'butter'],
		['nonstick cooking spray', 'oil-bottle'],
		['2 tsp cornflour', 'box'],
		['1 tsp cream of tartar', 'canister-tin'],
		['2 tbsp mirin', 'soy-dasher'],
		['2 oz. bourbon', 'spirit-flask'],
		['½ cup dried cranberries', 'grapes'],
		['1 baguette, sliced', 'bread'],
		['4 oz mascarpone', 'tub'],
		['½ cup labneh', 'tub'],
		['1 cup unsweetened applesauce', 'apple'],
		['2 tbsp flaxseed meal', 'seeds'],
		['2 tbsp cacao powder', 'canister-tin'],
		['2 tsp pure vanilla extract', 'dropper-bottle'],
		['1 tsp vanilla', 'dropper-bottle'],
		['1 cup vanilla ice cream', 'fallback-dairy'],
		['1 tbsp low-sodium soy sauce', 'soy-dasher'],
		['1 cup apple sauce', 'apple'],
		['4 cups low-sodium chicken broth', 'carton'],
		['2 cups vegetable stock', 'carton'],
		['2 tbsp red wine vinegar', 'oil-bottle'],
		['1 (15-ounce) can black beans, drained', 'beans'],
		['1 cup coffee beans', 'coffee-beans'],
		['200g green beans', 'green-beans'],
		['2 tbsp tahini', 'mason-jar'],
		['2 tbsp chia seeds', 'seeds'],
		['1 tsp ground ginger', 'shaker-jar'],
		['1 tbsp grated fresh ginger', 'ginger'],
		['1 (13.5-ounce) can coconut milk', 'tin-can'],
		['juice of 1 lime', 'lime'],
		['½ cup dry white wine', 'wine-bottle'],
		['2 tbsp white wine vinegar', 'oil-bottle'],
		['1 oz. dark rum', 'spirit-flask'],
		['1 head radicchio', 'fallback-vegetable'],
		['1 cup (240ml) milk', 'milk'],
		['1 and 1/2 cups (190g) all-purpose flour', 'sack'],
		['1 (15-ounce) can chickpeas, rinsed', 'beans'],
		['1 (14 oz) can diced tomatoes', 'tomato'],
		['1 (5-ounce) can tuna packed in extra-virgin olive oil', 'fish'],
		['2 cups Vanilla Bean Coconut Ice Cream', 'fallback-dairy'],
		['1 tbsp flaxseed oil', 'oil-bottle'],
		['1 tbsp sunflower seed oil', 'oil-bottle'],
		['1 tsp ginger powder', 'shaker-jar'],
		['1 tsp powdered ginger', 'shaker-jar'],
		['1 cup (2 sticks) unsalted butter', 'butter'],
		['1 cup broth (or milk)', 'carton'],
	])('uses a specific or familiar family icon for %s', (name, expected) => {
		expect(ingredientItemSprite(name)).toBe(expected)
	})
	test.each([
		['cream cheese', 'tub'],
		['ice cream', 'fallback-dairy'],
		['beef tomatoes', 'tomato'],
		['tuna in oil', 'fish'],
		['1 can tuna packed in extra virgin olive oil', 'fish'],
		['1 can tuna packed in extra-virgin olive oil', 'fish'],
		['2 cans tuna in spring water', 'fish'],
		['4 peach halves in heavy syrup', 'peach'],
		['sun-dried tomatoes in oil', 'tomato'],
		['salmon fillets with dill', 'salmon'],
		['cod with parsley', 'fish'],
		['herb butter', 'butter'],
		['1 cup heavy cream', 'milk'],
	])(
		'keeps the food, not its compound or garnish, for %s',
		(name, expected) => {
			expect(ingredientItemSprite(name)).toBe(expected)
		},
	)

	test.each([
		['sugar snap peas', 'flour'],
		['water chestnuts', 'ice-cube'],
		['vanilla bean', 'fallback-protein'],
		['coffee beans', 'fallback-protein'],
	])('does not give %s the family icon %s', (name, wrong) => {
		expect(ingredientItemSprite(name)).not.toBe(wrong)
	})

	test.each([
		['pineapple', 'pineapple'],
		['fresh green apples', 'apple'],
		['black pepper', 'black-pepper'],
		['peppercorns', 'black-pepper'],
		['eggplant', 'eggplant'],
		['coconut milk', 'can'],
		['peanut butter', 'spread'],
		['red pepper flakes', 'chili-pepper'],
		['JALAPEÑO', 'jalapeno'],
		['frozen shrimp', 'shrimp'],
		['mystery ingredient', 'fallback-other'],
		['', 'fallback-other'],
	])('matches %s without partial-word collisions', (name, key) => {
		expect(resolveSpriteSrc(name)).toBe(`/sprites/pantry/${key}.png`)
	})

	test.each([
		['oregano', 'spices', 'fallback-spice'],
		['oregano', undefined, 'fallback-vegetable'],
		['peanut butter', 'cans', 'spread'],
		['coconut milk', 'cans', 'can'],
		['cinnamon', 'spices', 'cinnamon'],
		['smoked paprika', 'spices', 'fallback-spice'],
		['white pepper', 'spices', 'fallback-spice'],
		['tofu', 'meat', 'tofu'],
		['mystery jar', 'other', 'fallback-other'],
	] as const)('resolves %s in %s to %s', (name, category, key) => {
		expect(resolveSpriteSrc(name, null, category)).toBe(
			`/sprites/pantry/${key}.png`,
		)
	})

	test('honors only known explicit keys', () => {
		expect(resolveSpriteSrc('apple', 'banana')).toBe(
			'/sprites/pantry/banana.png',
		)
		expect(resolveSpriteSrc('apple', '../../secret')).toBe(
			'/sprites/pantry/apple.png',
		)
		expect(resolveSpriteSrc('apple', 'fallback-fruit')).toBe(
			'/sprites/pantry/fallback-fruit.png',
		)
	})
})

describe('recolourable sprites', () => {
	test.each([
		['2 tbsp white vinegar', 'oil-bottle', '#E4EEF0'],
		['1 tbsp balsamic vinegar', 'oil-bottle', '#3B1C14'],
		['2 tbsp red wine vinegar', 'oil-bottle', '#7A1426'],
		['1 tsp ground turmeric', 'shaker-jar', '#E3A21A'],
		['1 tsp smoked paprika', 'shaker-jar', '#A8321A'],
		['1 tsp paprika', 'shaker-jar', '#C8421A'],
		['1 tsp ground cinnamon', 'shaker-jar', '#9A5B30'],
		['1 tsp kosher salt', 'salt-shaker', '#F1F1EE'],
		['1 cup water', 'tumbler', '#BFE0F0'],
		['1 cup orange juice', 'tumbler', '#F08A1A'],
		['1 cup red wine', 'wine-bottle', '#5A0F1E'],
		['1 cup dry white wine', 'wine-bottle', '#D8C26A'],
		['2 oz. vodka', 'spirit-flask', '#E4EEF0'],
		['2 oz. bourbon', 'spirit-flask', '#C77A1A'],
		['2 tbsp soy sauce', 'soy-dasher', '#2D1610'],
		['2 tbsp ketchup', 'squeeze-bottle', '#B8231A'],
		['1 tbsp honey', 'honey-jar', '#E8A317'],
		['2 tbsp maple syrup', 'oil-bottle', '#A8561A'],
		['3 cups all-purpose flour', 'sack', '#F4EFE4'],
		['1 cup brown sugar', 'sack', '#8A5A2E'],
		['2 tsp baking powder', 'canister-tin', '#3A6EA8'],
		['1 tbsp fresh basil', 'basil', '#2F7D32'],
		['1 tbsp chopped fresh parsley', 'herb-bunch', '#3E8A3F'],
		['2 cups red cabbage', 'cabbage', '#7A2F6A'],
		['1 green cabbage', 'cabbage', '#9CC96B'],
		['1 red chili, sliced', 'chile', '#C8231A'],
		['1 scotch bonnet chile', 'chile', '#E8832A'],
		['1 cup whole milk yogurt', 'tub', '#F5F1E6'],
		['2 tsp vanilla extract', 'dropper-bottle', '#4A2A14'],
	])('paints %s as %s in %s', (name, key, tint) => {
		expect(ingredientItemLook(name)).toEqual({ key, tint })
	})

	test('leaves a food that is not recolourable unpainted', () => {
		expect(ingredientItemLook('1 lime')).toEqual({ key: 'lime' })
		expect(ingredientItemLook('2 cups celery')).toEqual({ key: 'celery' })
		expect(ingredientItemLook('a mystery ingredient')).toBeUndefined()
	})

	// Words that also appear inside another food must not paint the wrong one.
	test.each([
		['2 cloves garlic', 'garlic'],
		['6 garlic cloves', 'garlic'],
		['1 cup honey roasted peanuts', 'nuts'],
		['2 dill pickles', 'cucumber'],
		['2 slices rye bread', 'bread'],
		['1 tsp fennel seeds', 'cork-jar'],
		['1 fresh fennel bulb', 'fennel'],
		['4 sugar snap peas', 'peas'],
		['2 flour tortillas', 'bread'],
		['1 tsp cinnamon sticks', 'cinnamon-sticks'],
		['1 cup oil-packed sun-dried tomatoes', 'tomato'],
		['1 vanilla bean pod', 'vanilla-pods'],
		['1 cup vanilla bean ice cream', 'fallback-dairy'],
		['1 cup milk or water', 'milk'],
		['1 tsp salted butter', 'butter'],
	])('keeps %s as %s', (name, key) => {
		expect(ingredientItemSprite(name)).toBe(key)
	})

	test('paints a pantry item by name, but never over a chosen sprite', () => {
		expect(resolveSpriteLook('white vinegar')).toEqual({
			key: 'oil-bottle',
			tint: '#E4EEF0',
		})
		expect(resolveSpriteLook('white vinegar', 'vinegar')).toEqual({
			key: 'vinegar',
		})
		expect(resolveSpriteLook('apple')).toEqual({ key: 'apple' })
	})
})
