import { describe, expect, test } from 'vite-plus/test'

import { ingredientItemSprite, resolveSpriteSrc } from './sprites'

describe('ingredient sprites', () => {
	test.each([
		['2 yellow onions, diced', 'onion'],
		['1 large egg', 'egg'],
		['400g plum tomatoes', 'tomato'],
		['2 potatoes', 'potato'],
		['cherries', 'cherry'],
		['2 tbsp chopped parsley', 'kale'],
		['handful chopped coriander to serve', 'kale'],
		['1 tsp ground coriander', 'fallback-spice'],
		['1 tsp garlic powder', 'fallback-spice'],
		['1 tsp yellow mustard seed', 'fallback-spice'],
		['1 chicken stock cube', 'fallback-other'],
		['2 tbsp fish sauce', 'sauce'],
		['1 tbsp coconut oil', 'olive-oil'],
		['250g Greek yogurt', 'milk'],
		['1 pork shoulder', 'meat'],
		['2 duck breasts', 'meat'],
		['2 turkey thighs', 'meat'],
		['200g green beans', 'fallback-vegetable'],
		['1 tsp dried thyme', 'kale'],
		['1 tbsp almond butter', 'spread'],
		['200g prawns', 'fish'],
		['150g red lentils', 'beans'],
		['1cm fresh ginger', 'ginger'],
		['25g toasted breadcrumbs', 'bread'],
		['1 tbsp brown sugar', 'flour'],
		['1 tbsp butter', 'butter'],
		['2 tbsp sultanas', 'grapes'],
		['2 pork sausages', 'sausage'],
		['1 package turkey bacon', 'bacon'],
		['2 beef steaks', 'steak'],
		['2 lb beef brisket', 'steak'],
		['1 pork shoulder', 'meat'],
		['1 cup water', 'ice-cube'],
		['1 cup warm water', 'ice-cube'],
		['1 cup milk or water', 'milk'],
		['1 cup coconut water', undefined],
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
		['coconut milk', 'can'],
		['egg noodles', 'wheat'],
		['freshly ground pepper', 'black-pepper'],
		['1 tsp pepper', 'black-pepper'],
		['1 red bell pepper, sliced', 'bell-pepper'],
		['½ tsp crushed red pepper', 'chili-pepper'],
		['1 tbsp ghee', 'butter'],
		['nonstick cooking spray', 'olive-oil'],
		['2 tsp cornflour', 'flour'],
		['1 tsp cream of tartar', 'flour'],
		['2 tbsp mirin', 'sauce'],
		['2 oz. bourbon', 'spirits'],
		['½ cup dried cranberries', 'grapes'],
		['1 baguette, sliced', 'bread'],
		['4 oz mascarpone', 'cheese'],
		['½ cup labneh', 'milk'],
		['1 cup unsweetened applesauce', 'apple'],
		['2 tbsp flaxseed meal', 'seeds'],
		['2 tbsp cacao powder', 'chocolate'],
		['2 tsp pure vanilla extract', 'extract'],
		['1 tsp vanilla', 'extract'],
		['1 cup vanilla ice cream', 'fallback-dairy'],
		['1 tbsp low-sodium soy sauce', 'sauce'],
		['1 cup apple sauce', 'apple'],
		['4 cups low-sodium chicken broth', 'broth'],
		['2 cups vegetable stock', 'broth'],
		['2 tbsp red wine vinegar', 'vinegar'],
		['1 (15-ounce) can black beans, drained', 'beans'],
		['1 cup coffee beans', 'coffee-beans'],
		['200g green beans', 'fallback-vegetable'],
		['2 tbsp tahini', 'spread'],
		['2 tbsp chia seeds', 'seeds'],
		['1 tsp ground ginger', 'fallback-spice'],
		['1 tbsp grated fresh ginger', 'ginger'],
		['1 (13.5-ounce) can coconut milk', 'can'],
		['juice of 1 lime', 'lime'],
		['½ cup dry white wine', 'wine'],
		['2 tbsp white wine vinegar', 'vinegar'],
		['1 oz. dark rum', 'spirits'],
		['1 head radicchio', 'fallback-vegetable'],
		['1 cup (240ml) milk', 'milk'],
		['1 and 1/2 cups (190g) all-purpose flour', 'flour'],
		['1 (15-ounce) can chickpeas, rinsed', 'beans'],
		['1 (14 oz) can diced tomatoes', 'tomato'],
		['1 (5-ounce) can tuna packed in extra-virgin olive oil', 'fish'],
		['2 cups Vanilla Bean Coconut Ice Cream', 'fallback-dairy'],
		['1 tbsp flaxseed oil', 'olive-oil'],
		['1 tbsp sunflower seed oil', 'olive-oil'],
		['1 tsp ginger powder', 'fallback-spice'],
		['1 tsp powdered ginger', 'fallback-spice'],
		['1 cup (2 sticks) unsalted butter', 'butter'],
		['1 cup broth (or milk)', 'broth'],
	])('uses a specific or familiar family icon for %s', (name, expected) => {
		expect(ingredientItemSprite(name)).toBe(expected)
	})
	test.each([
		['cream cheese', 'cheese'],
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
		['frozen shrimp', 'fallback-protein'],
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
		['tofu', 'meat', 'fallback-protein'],
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
