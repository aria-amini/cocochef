// Pantry sprites drawn once and painted per food, so white vinegar and
// balsamic share one bottle and turmeric and paprika share one jar. A tinted
// sprite is two files in public/sprites/pantry/tint/: <key>.fill.png marks the
// area to paint, and <key>.png holds the outline and shading to lay over it.
export const tintedSpriteKeys = [
	'basil',
	'box',
	'cabbage',
	'canister-tin',
	'carton',
	'chile',
	'chives',
	'cork-jar',
	'dill',
	'dropper-bottle',
	'herb-bunch',
	'honey-jar',
	'mason-jar',
	'oil-bottle',
	'packet',
	'paste-tube',
	'rosemary',
	'round-leaf-sprig',
	'sack',
	'salt-shaker',
	'shaker-jar',
	'shaker-jar-squat',
	'soy-dasher',
	'spice-pouch',
	'spice-tin',
	'spirit-flask',
	'spoon-heap',
	'squeeze-bottle',
	'tin-can',
	'tub',
	'tumbler',
	'window-pouch',
	'wine-bottle',
] as const

const tintedKeys = new Set<string>(tintedSpriteKeys)

export const isTintedSprite = (key: string) => tintedKeys.has(key)

// A sprite and, for a tinted one, the colour to paint it.
export type SpriteLook = { key: string; tint?: string }

type TintedKey = (typeof tintedSpriteKeys)[number]

export type Rule = readonly [key: string, pattern: RegExp, tint?: string]

// A clear liquid, which still reads as glass.
const CLEAR = '#E4EEF0'

const WHITE = '#F1F1EE'

const tinted = (key: TintedKey, tint: string, pattern: RegExp): Rule => [
	key,
	pattern,
	tint,
]

// Checked against a normalized food (lowercase, no accents or punctuation) in
// order, and ahead of the plain family rules in sprites.ts, so a specific food
// comes before the general one it belongs to. Whole spices, herbs and the
// like with art of their own are plain entries.
export const tintedFamilySprites: readonly Rule[] = [
	// Never a spice or a sauce.
	tinted('mason-jar', '#3A1E10', /\b(?:yeast extract|marmite|vegemite)\b/),
	tinted('salt-shaker', WHITE, /\bsalt\b(?! (?:pork|cod|herring|beef))/),

	// Whole spices.
	[
		'vanilla-pods',
		/^(?!.*\b(?:ice cream|yogurt)\b).*\bvanilla (?:beans?|pods?)\b(?! paste)/,
	],
	['star-anise', /\bstar anise\b/],
	['cardamom-pods', /\b(?:green |black )?cardamom (?:pods?|seeds?)\b/],
	['nutmeg', /\b(?:whole|fresh|freshly|grated|grating)\b(?: \w+)? nutmeg\b/],
	['cloves', /\bwhole cloves?\b|^cloves?$/],
	['saffron', /\bsaffron\b/],
	[
		'dried-chilies',
		/\bdried (?:[a-z]+ )?(?:chil+i(?:e?s)?|chiles?)\b(?! flakes?| powder)/,
	],

	// Seeds that are spices, in a corked jar.
	tinted('cork-jar', '#2A2018', /\bblack mustard seeds?\b/),
	tinted('cork-jar', '#C9A227', /\bmustard seeds?\b/),
	tinted('cork-jar', '#8A6A3A', /\bcumin seeds?\b/),
	tinted('cork-jar', '#B79B62', /\bcoriander seeds?\b/),
	tinted('cork-jar', '#A8A05A', /\bfennel seeds?\b/),
	tinted('cork-jar', '#6A4A2A', /\bcaraway(?: seeds?)?\b/),
	tinted('cork-jar', '#6A5A3A', /\banise?(?:ed)? seeds?\b/),
	tinted('cork-jar', '#B8862A', /\bfenugreek seeds?\b/),

	// Ground spices, in a shaker.
	tinted('shaker-jar', '#A8321A', /\bsmoked (?:[a-z]+ )*paprika\b/),
	tinted('shaker-jar', '#C8421A', /\bpaprika\b/),
	tinted(
		'shaker-jar',
		'#B8321C',
		/\b(?:cayenne|chil+i powder|chile powder|kashmiri|pul biber|sazon)\b/,
	),
	tinted('shaker-jar', '#E3A21A', /\bturmeric\b/),
	tinted('shaker-jar', '#A9743A', /\bcumin\b/),
	tinted(
		'shaker-jar',
		'#B79B62',
		/\bground coriander\b|\bcoriander (?:powder|power)\b/,
	),
	tinted(
		'shaker-jar',
		'#9A5B30',
		/\bcinnamon\b(?! (?:sticks?|chips|rolls?|buns?|toast))/,
	),
	tinted('shaker-jar', '#8A5A3C', /\bnutmeg\b/),
	tinted(
		'shaker-jar',
		'#5A3524',
		/\b(?:ground )?allspice\b|\bground cloves?\b/,
	),
	tinted(
		'shaker-jar',
		'#C79A55',
		/\b(?:ground|powdered) ginger\b|\bginger powder\b/,
	),
	tinted('spice-tin', '#D9A21E', /\bcurry powder\b|^(?:mild |hot )?curry$/),
	tinted(
		'spice-tin',
		'#8F4A2A',
		/\b(?:garam masala|tandoori masala|chaat masala|baharat)\b/,
	),
	tinted(
		'shaker-jar-squat',
		'#E8D9B0',
		/\b(?:garlic|onion) (?:powder|granules)\b/,
	),
	tinted(
		'shaker-jar-squat',
		'#E0B81A',
		/\b(?:mustard powder|dry mustard|ground mustard)\b/,
	),
	tinted('shaker-jar', '#8E1F2F', /\bsumac\b/),
	tinted('shaker-jar-squat', WHITE, /\b(?:msg|monosodium glutamate)\b/),
	tinted('shaker-jar', '#8AA05A', /\bcardamom\b/),
	tinted('shaker-jar', '#B8862A', /\bground fenugreek\b/),
	tinted(
		'shaker-jar',
		'#6B7A45',
		/^(?!.*\b(?:fresh|leaves|sprigs?)\b).*\b(?:dried (?:\w+ )?(?:oregano|thyme|basil|rosemary|sage|marjoram|dill|parsley|mint|tarragon|herbs?)|oregano|marjoram|italian seasoning|herbes de provence|poultry seasoning)\b/,
	),
	tinted('spice-pouch', '#B8521C', /\b(?:taco|fajita|adobo)\b.*\bseasoning\b/),
	tinted(
		'spice-pouch',
		'#B5651D',
		/\b(?:seasoning|spice blend|spice mix|mixed spice|five spice|za atar|zaatar|masala|spices?)\b/,
	),

	// Sweeteners and baking, in sacks, tins, boxes, and packets.
	tinted(
		'spoon-heap',
		WHITE,
		/\b(?:sweetener|xylitol|stevia|erythritol|monk fruit|sugar substitute)\b/,
	),
	tinted('sack', '#6A4020', /\bdark brown (?:soft )?sugar\b/),
	tinted('sack', '#5A3A1E', /\b(?:muscovado|molasses sugar)\b/),
	tinted('sack', '#8A5A2E', /\b(?:brown|demerara|turbinado)(?: soft)? sugar\b/),
	tinted('sack', '#7A5A3A', /\b(?:coconut|palm|jaggery) sugar\b|\bjaggery\b/),
	tinted('sack', '#FBFBF8', /\b(?:powdered|confectioners|icing) sugar\b/),
	tinted('sack', '#F4F2EC', /\bsugar\b(?! snap)/),
	tinted('canister-tin', '#3A6EA8', /\bbaking powder\b/),
	tinted('box', '#E8832A', /\b(?:baking soda|bicarbonate)\b/),
	tinted('canister-tin', WHITE, /\bcream of tartar\b/),
	tinted(
		'box',
		'#F0C830',
		/\b(?:cornstarch|corn starch|cornflour|arrowroot|potato starch|tapioca (?:starch|flour)|custard powder)\b/,
	),
	tinted('canister-tin', '#E8C84A', /\bnutritional yeast\b/),
	tinted('packet', '#C8302A', /\byeast\b/),
	tinted('packet', '#D8B060', /\bgelatin\b/),
	tinted('packet', WHITE, /\bxanthan gum\b/),
	tinted('canister-tin', '#6A3A24', /\b(?:cocoa|cacao) powder\b|\bcocoa$/),
	tinted(
		'sack',
		'#C9A56B',
		/\b(?:whole ?wheat|wholemeal) (?:flour|pastry flour)\b/,
	),
	tinted('sack', '#E8D3A8', /\b(?:almond flour|almond meal|ground almonds)\b/),
	tinted('sack', '#EFE6D0', /\bcoconut flour\b/),
	tinted('sack', '#E0CFA8', /\boat flour\b/),
	tinted('sack', '#EBD590', /\bsemolina\b/),
	tinted(
		'sack',
		'#E8C44A',
		/\b(?:cornmeal|corn meal|polenta|grits|masa harina)\b/,
	),
	tinted('sack', '#F4EFE4', /\bflour\b(?! tortillas?)/),

	// Grains and lentils, in a window pouch.
	tinted('window-pouch', '#C8541A', /\b(?:red|split red) lentils?\b/),
	tinted('window-pouch', '#2A2A2A', /\b(?:black|beluga) lentils?\b/),
	tinted('window-pouch', '#D9B83A', /\b(?:yellow|split) (?:lentils?|peas?)\b/),
	tinted('window-pouch', '#7A6A3A', /\blentils?\b/),
	tinted(
		'window-pouch',
		'#D9C49A',
		/\b(?:rolled |old fashioned |quick |steel cut )?oats\b|\boatmeal\b/,
	),
	tinted('window-pouch', '#D9B76A', /\bquinoa\b|\bcouscous\b/),
	tinted('window-pouch', '#C9A25A', /\b(?:bulgur|farro|freekeh)\b/),
	tinted('window-pouch', '#F1E8D0', /\bwhite chocolate chips\b/),
	tinted(
		'window-pouch',
		'#4A2A1C',
		/\b(?:semi sweet |dark |milk |mini )?chocolate chips\b/,
	),

	// Oils and vinegars, in a tall bottle.
	tinted('oil-bottle', '#B4B23C', /\bavocado oil\b/),
	tinted('oil-bottle', '#9A5A1E', /\bsesame oil\b/),
	tinted('mason-jar', WHITE, /\bcoconut oil\b/),
	tinted('oil-bottle', '#A8A21E', /\bolive oil\b/),
	tinted(
		'oil-bottle',
		'#E8D45A',
		/^(?!.*\boil packed\b).*\b(?:oils?|(?:cooking|baking|nonstick) spray)\b/,
	),
	tinted('oil-bottle', '#3B1C14', /\bbalsamic\b/),
	tinted('oil-bottle', '#7A1426', /\bred wine vinegar\b/),
	tinted('oil-bottle', '#C98A2B', /\bcider vinegar\b/),
	tinted('oil-bottle', '#EBDDA8', /\brice vinegar\b/),
	tinted('oil-bottle', '#9A5B30', /\b(?:sherry|malt) vinegar\b/),
	tinted('oil-bottle', '#2A1A10', /\bblack vinegar\b/),
	tinted('oil-bottle', CLEAR, /\b(?:white wine|white|distilled) vinegar\b/),
	tinted('oil-bottle', '#D8C48A', /\bvinegar\b/),

	// Syrups and honey.
	tinted(
		'honey-jar',
		'#E8A317',
		/^(?!.*\b(?:roasted|glazed|baked|mustard|nut|mango)\b).*\bhoney\b/,
	),
	tinted('mason-jar', '#5A1A24', /\bpomegranate molasses\b/),
	tinted('mason-jar', '#2A1A10', /^(?!.*\brum\b).*\bmolasses\b/),
	tinted('oil-bottle', '#3A1E10', /\bchocolate syrup\b/),
	tinted('oil-bottle', '#5A2A14', /\bdate syrup\b/),
	tinted('oil-bottle', '#D8A83A', /\bagave\b/),
	tinted('oil-bottle', '#EBDDA8', /\bcorn syrup\b/),
	tinted('oil-bottle', CLEAR, /\bsimple syrup\b/),
	tinted('oil-bottle', '#A8561A', /\b(?:maple )?syrup\b|\bmaple\b/),

	// Sauces.
	tinted('mason-jar', '#8A1530', /\bcranberry sauce\b/),
	tinted('mason-jar', '#A8321A', /\benchilada sauce\b/),
	tinted(
		'mason-jar',
		'#C8321E',
		/\b(?:tomato|marinara|pizza|pasta|arrabbiata) sauce\b|\bmarinara\b/,
	),
	tinted('squeeze-bottle', '#C98A2B', /\bcaramel sauce\b/),
	tinted('soy-dasher', '#2D1610', /\b(?:soy sauce|tamari|shoyu)\b/),
	tinted('soy-dasher', '#B5651D', /\bfish sauce\b/),
	tinted('soy-dasher', '#4A2418', /\b(?:worcestershire|teriyaki|ponzu)\b/),
	tinted('soy-dasher', '#2A1A10', /\b(?:oyster sauce|hoisin)\b/),
	tinted('soy-dasher', '#D9B75A', /\bmirin\b/),
	tinted('squeeze-bottle', '#7A2A14', /\bbbq sauce\b|\bbarbecue sauce\b/),
	tinted('squeeze-bottle', '#E8C32A', /\byellow mustard\b/),
	tinted(
		'squeeze-bottle',
		'#B8231A',
		/\b(?:ketchup|hot sauce|sriracha|chil+i sauce|chil+i garlic sauce|buffalo|frank s)\b/,
	),

	// Extracts and colouring, in a dropper.
	tinted('dropper-bottle', '#3FA66A', /\b(?:peppermint|mint) extract\b/),
	tinted('dropper-bottle', '#C99A5A', /\balmond extract\b/),
	tinted('dropper-bottle', '#EEE6C8', /\bcoconut extract\b/),
	tinted('dropper-bottle', '#3D8A2E', /\bgreen food colou?ring\b/),
	tinted('dropper-bottle', '#E86A9A', /\bpink food colou?ring\b/),
	tinted('dropper-bottle', '#2E5AC8', /\bblue food colou?ring\b/),
	tinted('dropper-bottle', '#E8C32A', /\byellow food colou?ring\b/),
	tinted('dropper-bottle', '#C8231A', /\bfood colou?ring\b/),
	tinted(
		'dropper-bottle',
		'#4A2A14',
		/^(?!.*\b(?:ice cream|pudding|yogurt|protein|icing|wafers?)\b)(?:.*\b(?:extract|essence|vanilla (?:bean )?paste)\b|(?:pure )?vanilla$)/,
	),

	// Cans and cartons.
	tinted('tin-can', '#EFE6C8', /\bcoconut (?:milk|cream)\b/),
	tinted('tin-can', '#F0E2B0', /\bcondensed milk\b/),
	tinted('tin-can', '#EDE3C8', /\bevaporated milk\b/),
	tinted('tin-can', '#D9731A', /\b(?:pumpkin pur[a-z]*|canned pumpkin)\b/),
	tinted(
		'packet',
		'#C8A02A',
		/\b(?:stock|bouillon) (?:cubes?|pots?|powder|paste)\b|\bbouillon (?:cubes?|powder|paste)\b/,
	),
	tinted('carton', '#8A4A24', /\bbeef (?:bone )?(?:broth|stock)\b/),
	tinted('carton', '#D98A2A', /\bvegetable (?:broth|stock)\b/),
	tinted(
		'carton',
		'#C9B27A',
		/\b(?:fish|seafood|clam) (?:broth|stock|juice)\b/,
	),
	tinted('carton', '#E8C86A', /\b(?:broth|stock|bouillon|consomme)\b/),
	tinted(
		'carton',
		'#EBDDB8',
		/\b(?:almond|oat|soy|soya|cashew|rice|hazelnut|pea|nut|non dairy|plant based) (?:milk|beverage|drink)\b|\balmondmilk\b/,
	),

	// Tubs of the cultured dairy.
	tinted('tub', '#F3EAD0', /\b(?:cream cheese|mascarpone)\b/),
	tinted(
		'tub',
		'#F5F1E6',
		/\b(?:sour cream|soured cream|creme fraiche|yogurt|yoghurt|labneh|skyr|quark|cottage cheese|ricotta|kefir)\b/,
	),

	// Jars of spreads, pastes, and preserves.
	tinted(
		'mason-jar',
		'#3A2A6A',
		/\b(?:blueberry|blackcurrant|grape|plum|fig)\b.*\b(?:jam|jelly|preserves?|marmalade)\b/,
	),
	tinted(
		'mason-jar',
		'#E0861A',
		/\b(?:apricot|orange|peach|mango|lemon|ginger)\b.*\b(?:jam|jelly|preserves?|marmalade)\b|\bmarmalade\b/,
	),
	tinted(
		'mason-jar',
		'#B3182A',
		/\b(?:jam|jelly|preserves?|conserve|compote)\b/,
	),
	tinted(
		'mason-jar',
		'#4A2A1C',
		/\b(?:nutella|chocolate (?:hazelnut )?spread)\b/,
	),
	tinted('mason-jar', '#C9A065', /\b(?:almond|cashew) butter\b/),
	tinted(
		'mason-jar',
		'#C9944F',
		/\b(?:peanut|nut|sunflower seed) butter\b|\bbiscoff\b/,
	),
	tinted('mason-jar', '#D9B77A', /\b(?:tahini|hummus)\b/),
	tinted('mason-jar', '#E8D8A8', /\b(?:white|yellow|shiro) miso\b/),
	tinted('mason-jar', '#8A4A2A', /\b(?:red|dark|aka) miso\b/),
	tinted('mason-jar', '#C9944F', /\bmiso\b/),
	tinted('mason-jar', '#F2E6C0', /\b(?:mayonnaise|mayo|aioli)\b/),
	tinted(
		'mason-jar',
		'#C9A94A',
		/\b(?:dijon|whole grain mustard|stone ?ground mustard|english mustard|mustard)\b(?! (?:greens?|seeds?|powder))/,
	),
	tinted('mason-jar', '#4E7A2E', /\bpesto\b/),
	tinted(
		'mason-jar',
		'#C8321E',
		/\b(?:salsa|pico de gallo|kimchi|peppadew|pepperoncini)\b/,
	),
	tinted(
		'mason-jar',
		'#B8231A',
		/\b(?:gochujang|harissa|sambal|ssamjang|kochujang)\b/,
	),
	tinted('mason-jar', '#6B7A3A', /\b(?:capers|cornichons|relish)\b/),
	tinted(
		'mason-jar',
		'#8A2A1A',
		/\bchipotle(?: chil+i| peppers?)?s? in adobo\b/,
	),
	tinted('mason-jar', '#C98A2B', /\b(?:dulce de leche|caramel)\b(?! candies)/),
	tinted('mason-jar', WHITE, /\b(?:marshmallow creme|horseradish)\b/),
	tinted('paste-tube', '#6A9A3A', /\bwasabi\b/),
	tinted('paste-tube', '#5A2A14', /\btamarind\b/),
	tinted('paste-tube', '#C8806A', /\banchovy paste\b/),
	tinted('paste-tube', '#C8321E', /\btomato paste\b|\btomato puree\b/),
	tinted('paste-tube', '#5A8A2E', /\bgreen curry paste\b/),
	tinted('paste-tube', '#D9A21E', /\byellow curry paste\b/),
	tinted(
		'paste-tube',
		'#B8231A',
		/\b(?:red )?curry paste\b|\bchil+i paste\b|\bchipotle paste\b/,
	),

	// Wine and spirits.
	tinted(
		'spirit-flask',
		'#E4EEF0',
		/\b(?:vodka|gin|soju|sake|silver tequila|tequila blanco|white rum|light rum|silver rum)\b/,
	),
	tinted('spirit-flask', '#7A3E14', /\b(?:dark|spiced|aged)? ?rum\b/),
	tinted('spirit-flask', '#C77A1A', /\b(?:bourbon|whiskey|whisky)\b/),
	tinted(
		'spirit-flask',
		'#A8561A',
		/\b(?:brandy|cognac|sherry|marsala|madeira|port|liqueur)\b/,
	),
	tinted(
		'spirit-flask',
		'#E0861A',
		/\b(?:triple sec|cointreau|grand marnier|orange liqueur)\b/,
	),
	tinted('spirit-flask', '#C8231A', /\b(?:campari|aperol)\b/),
	tinted('spirit-flask', '#E4EEF0', /\btequila\b/),
	tinted('spirit-flask', '#DDE8C0', /\b(?:pernod|pastis|absinthe|ouzo)\b/),
	tinted(
		'wine-bottle',
		'#D8C26A',
		/\b(?:vermouth|white wine|dry white|sauvignon blanc|chardonnay|pinot grigio|riesling|champagne|prosecco|sparkling wine|rice wine|shaoxing)\b/,
	),
	tinted(
		'wine-bottle',
		'#5A0F1E',
		/\b(?:wine|merlot|cabernet|pinot noir|shiraz)\b/,
	),

	// Drinks, in a glass.
	tinted('tumbler', '#EEE6D8', /\bcoconut water\b/),
	tinted(
		'tumbler',
		'#DDEEF2',
		/\b(?:club soda|seltzer|soda water|sparkling water|tonic(?: water)?|mineral water)\b/,
	),
	tinted('tumbler', '#3A2010', /\b(?:stout|porter)\b/),
	tinted(
		'tumbler',
		'#D99A1A',
		/\b(?:beer|lager|pilsner|ipa)\b|\b(?<!ginger )ale\b/,
	),
	tinted(
		'tumbler',
		'#F08A1A',
		/^(?:fresh |freshly squeezed |pure )*orange juice$/,
	),
	tinted('tumbler', '#D9A32A', /^(?:fresh |pure )*apple juice$/),
	tinted(
		'tumbler',
		'#8A1530',
		/^(?:fresh |pure |unsweetened )*(?:cranberry|pomegranate)(?: juice cocktail| juice)$/,
	),
	tinted('tumbler', '#E8708A', /\bgrapefruit juice\b/),
	tinted('tumbler', '#E8C84A', /\bpineapple juice\b/),
	tinted('tumbler', '#C8321E', /\btomato juice\b/),
	tinted('tumbler', '#E8A33A', /^(?:fresh )?(?:citrus )?juice$/),
	tinted('box', '#8A4A2A', /\btea bags?\b/),
	tinted(
		'tumbler',
		'#A8561A',
		/^(?:(?:brewed|strong|black|green|hot|cold) )*tea$/,
	),
	tinted('tumbler', '#C98A2B', /\b(?:apple )?cider\b/),
	tinted(
		'tumbler',
		'#BFE0F0',
		/^(?!.*\bor\b).*(?<!rose |flower |orange blossom )\bwater\b(?! chestnut)/,
	),

	// Herbs: fresh ones painted by the herb, dried ones are in the shaker above.
	['bay-leaves', /\bbay (?:leaf|leaves)\b/],
	['lemongrass', /\blemon ?grass\b/],
	tinted(
		'herb-bunch',
		'#4A9A45',
		/\b(?:cilantro|coriander (?:leaves|leaf)|(?:fresh|chopped) coriander|coriander to serve)\b/,
	),
	tinted('herb-bunch', '#3E8A3F', /\bparsley\b/),
	tinted('herb-bunch', '#4A9A45', /\bcoriander\b/),
	tinted('basil', '#2F7D32', /\bbasil\b/),
	tinted('basil', '#3FA66A', /\bmint\b/),
	tinted('round-leaf-sprig', '#5E7B3A', /\bthyme\b/),
	tinted('round-leaf-sprig', '#8AA58A', /\bsage\b/),
	tinted('rosemary', '#4F6F55', /\brosemary\b/),
	tinted('dill', '#6AA84F', /\bdill\b(?! pickles?| weed)/),
	tinted('dill', '#6F8F4A', /\btarragon\b/),
	tinted('chives', '#5A9A3A', /\bchives\b/),

	// Cabbage and fresh chiles, painted by variety.
	tinted('cabbage', '#7A2F6A', /\b(?:red|purple) cabbage\b/),
	tinted('cabbage', '#C8E08A', /\b(?:napa|chinese) cabbage\b|\bnapa\b/),
	tinted('cabbage', '#7AA84A', /\bsavoy cabbage\b/),
	tinted('cabbage', '#9CC96B', /\bcabbage\b/),
	tinted('chile', '#E8832A', /\b(?:habanero|scotch bonnet)\b/),
	tinted('chile', '#2E6A2A', /\bpoblano\b/),
	tinted('chile', '#5A9A3A', /\b(?:anaheim|green (?:chil+i|chile)(?:e?s)?)\b/),
	tinted(
		'chile',
		'#C8231A',
		/^(?!.*\b(?:flakes?|powder|sauce|paste|oil|crisp|garlic)\b).*\b(?:chil+i(?:e?s)?|chiles?|fresno|guajillo|ancho|chipotle)\b/,
	),
]

// The look of a food that has a tinted sprite.
export function tintedLook(food: string): SpriteLook | undefined {
	const rule = tintedFamilySprites.find(([, pattern]) => pattern.test(food))

	if (!rule) return undefined

	const [key, , tint] = rule

	return tint ? { key, tint } : { key }
}
