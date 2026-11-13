// The parts of a meal, after Ethan Chlebowski's healthy home cooking
// framework: a flavor, a protein, and a form, with toppings to finish. A
// flavor belongs to a cuisine, and a title that names one ("gochujang") is
// of that cuisine too.
//
// Every recipe title is read for these parts by the words it uses ("cajun
// chicken tacos" is north american, american, cajun, chicken, tacos), so the
// finder can count what exists for each pick and never offer one that leads
// nowhere.

type Words = readonly string[]

type Part = { name: string; sprite: string; words: Words }

// A country's cooking, named as food is ("persian", not "iran"), with the
// flag of where it comes from.
type Country = Part & { flag: string; flavors: readonly Part[] }

// A part of the world whose countries share dishes. A dish that belongs to
// the whole region (hummus, jollof, borscht) is tagged with the region alone,
// since no one country owns it.
type Region = Part & { flavors: readonly Part[]; countries: readonly Country[] }

const country = (
	name: string,
	flag: string,
	sprite: string,
	words: Words,
	flavors: readonly Part[] = [],
): Country => ({ name, flag, sprite, words, flavors })

const cuisineRegions: readonly Region[] = [
	{
		name: 'east asian',
		sprite: 'rice',
		words: ['east asian'],
		flavors: [],
		countries: [
			country(
				'chinese',
				'CN',
				'star-anise',
				[
					'chinese',
					'lo mein',
					'chow mein',
					'fried rice',
					'dumpling',
					'wonton',
					'mapo',
					'dan dan',
					'general tso',
					'orange chicken',
					'sesame chicken',
					'egg foo young',
					'bao',
					'cantonese',
					'hunan',
					'xinjiang',
					'uyghur',
				],
				[
					{
						name: 'sichuan',
						sprite: 'dried-chilies',
						words: ['sichuan', 'szechuan', 'kung pao', 'mapo', 'dan dan'],
					},
					{ name: 'hoisin', sprite: 'sauce', words: ['hoisin', 'char siu'] },
					{
						name: 'black bean',
						sprite: 'beans',
						words: ['black bean sauce'],
					},
				],
			),
			country(
				'japanese',
				'JP',
				'rice',
				[
					'japanese',
					'ramen',
					'udon',
					'soba',
					'sushi',
					'donburi',
					'tempura',
					'yakitori',
					'okonomiyaki',
					'onigiri',
					'gyudon',
					'oyakodon',
					'karaage',
					'sukiyaki',
				],
				[
					{ name: 'teriyaki', sprite: 'honey', words: ['teriyaki'] },
					{ name: 'miso', sprite: 'beans', words: ['miso'] },
					{ name: 'katsu', sprite: 'bread', words: ['katsu', 'tonkatsu'] },
				],
			),
			country(
				'korean',
				'KR',
				'dried-chilies',
				['korean', 'bibimbap', 'japchae', 'tteokbokki', 'kimbap', 'jjigae'],
				[
					{ name: 'gochujang', sprite: 'chili-pepper', words: ['gochujang'] },
					{ name: 'bulgogi', sprite: 'meat', words: ['bulgogi', 'galbi'] },
					{ name: 'kimchi', sprite: 'lettuce', words: ['kimchi'] },
				],
			),
			country('taiwanese', 'TW', 'star-anise', [
				'taiwanese',
				'three cup chicken',
				'lu rou fan',
				'gua bao',
			]),
			country('mongolian', 'MN', 'meat', ['mongolian']),
			country('hong kong', 'HK', 'rice', ['hong kong', 'cha chaan teng']),
			country('macanese', 'MO', 'egg', ['macanese', 'minchi']),
		],
	},
	{
		name: 'southeast asian',
		sprite: 'lemongrass',
		words: ['southeast asian', 'satay', 'sambal'],
		flavors: [],
		countries: [
			country(
				'thai',
				'TH',
				'lemongrass',
				[
					'thai',
					'pad thai',
					'pad see ew',
					'larb',
					'tom yum',
					'tom kha',
					'massaman',
					'panang',
					'khao soi',
				],
				[
					{
						name: 'green curry',
						sprite: 'lemongrass',
						words: ['green curry'],
					},
					{ name: 'red curry', sprite: 'chili-pepper', words: ['red curry'] },
					{ name: 'peanut', sprite: 'nuts', words: ['peanut'] },
				],
			),
			country(
				'vietnamese',
				'VN',
				'lime',
				['vietnamese', 'pho', 'banh mi', 'bun cha', 'nuoc cham', 'bun bo hue'],
				[
					{
						name: 'lemongrass',
						sprite: 'lemongrass',
						words: ['lemongrass'],
					},
				],
			),
			country('filipino', 'PH', 'vinegar', [
				'filipino',
				'sinigang',
				'pancit',
				'lumpia',
				'kare kare',
				'sisig',
				'lechon',
				'tinola',
			]),
			country('indonesian', 'ID', 'chili-pepper', [
				'indonesian',
				'nasi goreng',
				'rendang',
				'gado gado',
				'mie goreng',
			]),
			country('malaysian', 'MY', 'coconut-half', [
				'malaysian',
				'laksa',
				'nasi lemak',
				'char kway teow',
			]),
			country('singaporean', 'SG', 'chili-pepper', [
				'singaporean',
				'hainanese',
				'chili crab',
			]),
			country('burmese', 'MM', 'fish', ['burmese', 'mohinga']),
			country('cambodian', 'KH', 'lime', ['cambodian', 'khmer', 'amok']),
			country('laotian', 'LA', 'lime', ['laotian', 'lao']),
			country('timorese', 'TL', 'corn', ['timorese']),
			country('bruneian', 'BN', 'rice', ['bruneian', 'ambuyat']),
		],
	},
	{
		name: 'south asian',
		sprite: 'cardamom-pods',
		words: ['south asian', 'desi'],
		flavors: [],
		countries: [
			country(
				'indian',
				'IN',
				'cardamom-pods',
				[
					'indian',
					'dal',
					'dhal',
					'daal',
					'biryani',
					'saag',
					'paneer',
					'chana',
					'aloo',
					'naan',
					'butter chicken',
					'korma',
					'vindaloo',
					'jalfrezi',
					'rogan josh',
					'samosa',
					'dosa',
					'sambar',
				],
				[
					{ name: 'tandoori', sprite: 'chili-pepper', words: ['tandoori'] },
					{ name: 'tikka', sprite: 'tomato', words: ['tikka'] },
					{
						name: 'masala',
						sprite: 'cardamom-pods',
						words: ['masala', 'garam masala'],
					},
				],
			),
			country('pakistani', 'PK', 'meat', [
				'pakistani',
				'nihari',
				'haleem',
				'karahi',
			]),
			country('bangladeshi', 'BD', 'fish', ['bangladeshi']),
			country('sri lankan', 'LK', 'coconut-half', [
				'sri lankan',
				'kottu',
				'hoppers',
			]),
			country('nepali', 'NP', 'dough', ['nepali', 'nepalese', 'momo']),
			country('afghan', 'AF', 'rice', ['afghan', 'kabuli', 'bolani']),
			country('bhutanese', 'BT', 'chili-pepper', ['bhutanese', 'ema datshi']),
			country('maldivian', 'MV', 'fish', ['maldivian', 'mas huni']),
		],
	},
	{
		name: 'middle eastern',
		sprite: 'olives',
		words: [
			'middle eastern',
			'levantine',
			'falafel',
			'hummus',
			'kebab',
			'kabob',
			'kofta',
			'fattoush',
			'tabbouleh',
			'baba ganoush',
			'mezze',
		],
		flavors: [
			{ name: "za'atar", sprite: 'seeds', words: ["za'atar", 'zaatar'] },
			{ name: 'tahini', sprite: 'seeds', words: ['tahini'] },
			{ name: 'shawarma', sprite: 'cinnamon', words: ['shawarma'] },
		],
		countries: [
			country('persian', 'IR', 'saffron', [
				'persian',
				'iranian',
				'tahdig',
				'ghormeh sabzi',
				'fesenjan',
				'kuku',
				'joojeh',
				'koobideh',
				'ash reshteh',
				'zereshk',
				'polo',
			]),
			country('lebanese', 'LB', 'olive-oil', [
				'lebanese',
				'manakish',
				'kibbeh',
				'toum',
			]),
			country('turkish', 'TR', 'eggplant', [
				'turkish',
				'pide',
				'lahmacun',
				'doner',
				'iskender',
				'menemen',
				'borek',
				'kofte',
				'imam bayildi',
			]),
			country('israeli', 'IL', 'eggplant', ['israeli', 'sabich']),
			country('palestinian', 'PS', 'olive-oil', [
				'palestinian',
				'musakhan',
				'maqluba',
				'maqloubeh',
			]),
			country('syrian', 'SY', 'pomegranate', ['syrian', 'muhammara']),
			country('jordanian', 'JO', 'meat', ['jordanian', 'mansaf']),
			country('iraqi', 'IQ', 'fish', ['iraqi', 'masgouf']),
			country('yemeni', 'YE', 'chili-pepper', ['yemeni', 'zhug', 'mandi']),
			country('armenian', 'AM', 'meat', ['armenian']),
			country('saudi', 'SA', 'rice', ['saudi', 'kabsa']),
			country('emirati', 'AE', 'dates', ['emirati', 'machboos', 'luqaimat']),
			country('kuwaiti', 'KW', 'rice', ['kuwaiti']),
			country('qatari', 'QA', 'rice', ['qatari']),
			country('omani', 'OM', 'dates', ['omani', 'shuwa']),
			country('bahraini', 'BH', 'rice', ['bahraini']),
			country('azerbaijani', 'AZ', 'meat', ['azerbaijani', 'azeri', 'plov']),
		],
	},
	{
		name: 'north african',
		sprite: 'dates',
		words: ['north african', 'maghrebi', 'shakshuka', 'couscous'],
		flavors: [{ name: 'harissa', sprite: 'dried-chilies', words: ['harissa'] }],
		countries: [
			country('moroccan', 'MA', 'dates', [
				'moroccan',
				'tagine',
				'harira',
				'chermoula',
				'ras el hanout',
				'pastilla',
				'bastilla',
			]),
			country('tunisian', 'TN', 'dried-chilies', [
				'tunisian',
				'brik',
				'lablabi',
			]),
			country('egyptian', 'EG', 'beans', [
				'egyptian',
				'koshari',
				'kushari',
				'ful medames',
				'molokhia',
			]),
			country('algerian', 'DZ', 'olives', ['algerian']),
			country('libyan', 'LY', 'olives', ['libyan']),
			country('sudanese', 'SD', 'beans', ['sudanese']),
			country('mauritanian', 'MR', 'rice', ['mauritanian']),
		],
	},
	{
		name: 'west african',
		sprite: 'plantain',
		words: ['west african', 'jollof', 'fufu'],
		flavors: [],
		countries: [
			country('nigerian', 'NG', 'chili-pepper', [
				'nigerian',
				'egusi',
				'suya',
				'puff puff',
			]),
			country('ghanaian', 'GH', 'plantain', ['ghanaian', 'kelewele', 'waakye']),
			country('senegalese', 'SN', 'onion', [
				'senegalese',
				'yassa',
				'thieboudienne',
				'mafe',
			]),
			country('ivorian', 'CI', 'plantain', ['ivorian', 'attieke']),
			country('liberian', 'LR', 'rice', ['liberian']),
			country('sierra leonean', 'SL', 'kale', ['sierra leonean']),
			country('malian', 'ML', 'rice', ['malian', 'tigadegena']),
			country('beninese', 'BJ', 'corn', ['beninese']),
			country('togolese', 'TG', 'corn', ['togolese']),
			country('gambian', 'GM', 'nuts', ['gambian', 'domoda']),
			country('burkinabe', 'BF', 'corn', ['burkinabe']),
			country('guinean', 'GN', 'rice', ['guinean']),
			country('cape verdean', 'CV', 'beans', ['cape verdean', 'cachupa']),
		],
	},
	{
		name: 'east african',
		sprite: 'dried-chilies',
		words: ['east african', 'pilau'],
		flavors: [],
		countries: [
			country('ethiopian', 'ET', 'dried-chilies', [
				'ethiopian',
				'doro wat',
				'injera',
				'berbere',
				'tibs',
				'misir wot',
				'shiro',
			]),
			country('eritrean', 'ER', 'dried-chilies', ['eritrean']),
			country('somali', 'SO', 'rice', ['somali', 'somalian']),
			country('kenyan', 'KE', 'kale', [
				'kenyan',
				'sukuma wiki',
				'nyama choma',
				'ugali',
			]),
			country('tanzanian', 'TZ', 'coconut-half', ['tanzanian']),
			country('ugandan', 'UG', 'plantain', ['ugandan', 'rolex', 'matoke']),
			country('rwandan', 'RW', 'beans', ['rwandan']),
			country('burundian', 'BI', 'beans', ['burundian']),
			country('djiboutian', 'DJ', 'meat', ['djiboutian']),
			country('malagasy', 'MG', 'rice', ['malagasy', 'romazava']),
			country('mauritian', 'MU', 'fish', ['mauritian', 'dholl puri']),
			country('seychellois', 'SC', 'fish', ['seychellois']),
		],
	},
	{
		name: 'southern african',
		sprite: 'corn',
		words: ['southern african'],
		flavors: [],
		countries: [
			country('south african', 'ZA', 'sausage', [
				'south african',
				'bobotie',
				'bunny chow',
				'chakalaka',
				'braai',
				'boerewors',
			]),
			country('mozambican', 'MZ', 'shrimp', ['mozambican']),
			country('zimbabwean', 'ZW', 'corn', ['zimbabwean', 'sadza']),
			country('zambian', 'ZM', 'corn', ['zambian', 'nshima']),
			country('botswanan', 'BW', 'meat', ['botswanan', 'seswaa']),
			country('namibian', 'NA', 'meat', ['namibian']),
			country('malawian', 'MW', 'fish', ['malawian']),
			country('angolan', 'AO', 'fish', ['angolan', 'muamba']),
			country('eswatini', 'SZ', 'corn', ['eswatini', 'swazi']),
		],
	},
	{
		name: 'southern european',
		sprite: 'olive-oil',
		words: ['mediterranean'],
		flavors: [],
		countries: [
			country(
				'italian',
				'IT',
				'tomato',
				[
					'italian',
					'risotto',
					'lasagna',
					'lasagne',
					'gnocchi',
					'bolognese',
					'cacciatore',
					'saltimbocca',
					'puttanesca',
					'arrabbiata',
					'cacio e pepe',
					'osso buco',
					'ragu',
					'minestrone',
					'focaccia',
					'pizza',
				],
				[
					{ name: 'pesto', sprite: 'garlic', words: ['pesto'] },
					{
						name: 'marinara',
						sprite: 'tomato',
						words: ['marinara', 'pomodoro', 'tomato sauce'],
					},
					{ name: 'piccata', sprite: 'lemon', words: ['piccata'] },
					{
						name: 'parmesan',
						sprite: 'cheese',
						words: ['parmesan', 'parmigiana', 'parm'],
					},
					{ name: 'carbonara', sprite: 'egg', words: ['carbonara'] },
				],
			),
			country(
				'greek',
				'GR',
				'olive-oil',
				['greek', 'souvlaki', 'gyro', 'moussaka', 'spanakopita', 'pastitsio'],
				[
					{
						name: 'lemon herb',
						sprite: 'lemon',
						words: ['lemon herb', 'lemon oregano', 'lemon garlic'],
					},
					{ name: 'tzatziki', sprite: 'cucumber', words: ['tzatziki'] },
				],
			),
			country(
				'spanish',
				'ES',
				'saffron',
				[
					'spanish',
					'paella',
					'gazpacho',
					'romesco',
					'patatas bravas',
					'tapas',
					'tortilla espanola',
				],
				[
					{
						name: 'smoked paprika',
						sprite: 'dried-chilies',
						words: ['smoked paprika', 'chorizo'],
					},
				],
			),
			country('portuguese', 'PT', 'fish', [
				'portuguese',
				'bacalhau',
				'caldo verde',
				'piri piri',
				'peri peri',
			]),
			country('maltese', 'MT', 'bread', ['maltese', 'pastizzi']),
			country('cypriot', 'CY', 'cheese', ['cypriot', 'halloumi']),
			country('sammarinese', 'SM', 'bread', ['sammarinese']),
		],
	},
	{
		name: 'western european',
		sprite: 'butter',
		words: ['western european'],
		flavors: [],
		countries: [
			country(
				'french',
				'FR',
				'butter',
				[
					'french',
					'coq au vin',
					'ratatouille',
					'bourguignon',
					'provencal',
					'nicoise',
					'gratin',
					'quiche',
					'cassoulet',
					'bouillabaisse',
					'croque',
				],
				[
					{
						name: 'dijon',
						sprite: 'mustard',
						words: ['dijon', 'mustard'],
					},
					{
						name: 'garlic butter',
						sprite: 'garlic',
						words: ['garlic butter', 'beurre blanc', 'brown butter'],
					},
				],
			),
			country('british', 'GB', 'potato', [
				'british',
				'english',
				'scottish',
				'welsh',
				"shepherd's pie",
				'cottage pie',
				'fish and chips',
				'bangers',
				'toad in the hole',
				'haggis',
				'cullen skink',
				'rarebit',
			]),
			country('irish', 'IE', 'potato', [
				'irish',
				'colcannon',
				'boxty',
				'coddle',
			]),
			country('german', 'DE', 'sausage', [
				'german',
				'schnitzel',
				'spaetzle',
				'bratwurst',
				'sauerbraten',
				'rouladen',
			]),
			country('austrian', 'AT', 'meat', ['austrian', 'wiener schnitzel']),
			country('swiss', 'CH', 'cheese', [
				'swiss',
				'fondue',
				'raclette',
				'rosti',
			]),
			country('belgian', 'BE', 'potato', ['belgian', 'moules', 'carbonnade']),
			country('dutch', 'NL', 'potato', ['dutch', 'stamppot']),
			country('luxembourgish', 'LU', 'potato', ['luxembourgish']),
			country('liechtensteiner', 'LI', 'cheese', ['liechtensteiner']),
		],
	},
	{
		name: 'nordic',
		sprite: 'salmon',
		words: ['nordic', 'scandinavian'],
		flavors: [],
		countries: [
			country('swedish', 'SE', 'meat', ['swedish']),
			country('norwegian', 'NO', 'salmon', ['norwegian']),
			country('danish', 'DK', 'bread', ['danish', 'smorrebrod']),
			country('finnish', 'FI', 'fish', ['finnish']),
			country('icelandic', 'IS', 'fish', ['icelandic', 'skyr']),
		],
	},
	{
		name: 'eastern european',
		sprite: 'potato',
		words: ['eastern european', 'borscht', 'borsch'],
		flavors: [],
		countries: [
			country('polish', 'PL', 'sausage', [
				'polish',
				'pierogi',
				'pierogies',
				'kielbasa',
				'bigos',
				'golabki',
			]),
			country('russian', 'RU', 'mushroom', [
				'russian',
				'stroganoff',
				'pelmeni',
				'blini',
			]),
			country('ukrainian', 'UA', 'beans', [
				'ukrainian',
				'varenyky',
				'chicken kyiv',
				'chicken kiev',
			]),
			country('hungarian', 'HU', 'dried-chilies', [
				'hungarian',
				'goulash',
				'paprikash',
			]),
			country('georgian', 'GE', 'cheese', ['georgian', 'khachapuri']),
			country('romanian', 'RO', 'meat', ['romanian', 'sarmale']),
			country('czech', 'CZ', 'meat', ['czech']),
			country('slovak', 'SK', 'potato', ['slovak', 'bryndzove halusky']),
			country('belarusian', 'BY', 'potato', ['belarusian', 'draniki']),
			country('moldovan', 'MD', 'corn', ['moldovan', 'mamaliga']),
			country('lithuanian', 'LT', 'potato', [
				'lithuanian',
				'cepelinai',
				'saltibarsciai',
			]),
			country('latvian', 'LV', 'bread', ['latvian']),
			country('estonian', 'EE', 'fish', ['estonian']),
		],
	},
	{
		name: 'latin american',
		sprite: 'corn',
		words: ['latin american', 'empanada', 'arepa', 'chimichurri'],
		flavors: [],
		countries: [
			country(
				'mexican',
				'MX',
				'chili-pepper',
				[
					'mexican',
					'enchilada',
					'quesadilla',
					'burrito',
					'fajita',
					'carnitas',
					'birria',
					'pozole',
					'tamale',
					'tostada',
					'chilaquiles',
					'elote',
					'tinga',
					'mole',
					'pico de gallo',
					'guacamole',
				],
				[
					{ name: 'chipotle', sprite: 'dried-chilies', words: ['chipotle'] },
					{ name: 'adobo', sprite: 'chili-pepper', words: ['adobo'] },
					{ name: 'al pastor', sprite: 'pineapple', words: ['al pastor'] },
					{
						name: 'salsa verde',
						sprite: 'lime',
						words: ['salsa verde', 'tomatillo'],
					},
					{
						name: 'chili lime',
						sprite: 'lime',
						words: ['chili lime', 'chile lime'],
					},
				],
			),
			country('peruvian', 'PE', 'lime', [
				'peruvian',
				'ceviche',
				'lomo saltado',
				'aji amarillo',
				'pollo a la brasa',
			]),
			country('brazilian', 'BR', 'beans', [
				'brazilian',
				'feijoada',
				'moqueca',
				'picanha',
			]),
			country('argentinian', 'AR', 'steak', [
				'argentinian',
				'argentine',
				'milanesa',
			]),
			country('colombian', 'CO', 'corn', [
				'colombian',
				'bandeja paisa',
				'ajiaco',
			]),
			country('venezuelan', 'VE', 'corn', ['venezuelan', 'pabellon']),
			country('salvadoran', 'SV', 'corn', ['salvadoran', 'pupusa']),
			country('chilean', 'CL', 'corn', ['chilean', 'pastel de choclo']),
			country('guatemalan', 'GT', 'corn', ['guatemalan', 'pepian']),
			country('ecuadorian', 'EC', 'shrimp', [
				'ecuadorian',
				'encebollado',
				'llapingachos',
			]),
			country('bolivian', 'BO', 'potato', ['bolivian', 'saltena', 'saltenas']),
			country('paraguayan', 'PY', 'corn', [
				'paraguayan',
				'chipa',
				'sopa paraguaya',
			]),
			country('uruguayan', 'UY', 'steak', ['uruguayan', 'chivito']),
			country('honduran', 'HN', 'beans', ['honduran', 'baleada', 'baleadas']),
			country('nicaraguan', 'NI', 'beans', [
				'nicaraguan',
				'gallo pinto',
				'nacatamal',
			]),
			country('costa rican', 'CR', 'beans', ['costa rican', 'casado']),
			country('panamanian', 'PA', 'rice', ['panamanian', 'sancocho panameno']),
			country('belizean', 'BZ', 'beans', ['belizean']),
			country('guyanese', 'GY', 'meat', ['guyanese', 'pepperpot']),
			country('surinamese', 'SR', 'chicken', ['surinamese', 'pom']),
		],
	},
	{
		name: 'caribbean',
		sprite: 'mango',
		words: ['caribbean', 'plantain', 'west indian'],
		flavors: [],
		countries: [
			country(
				'jamaican',
				'JM',
				'chili-pepper',
				['jamaican', 'ackee', 'escovitch'],
				[{ name: 'jerk', sprite: 'chili-pepper', words: ['jerk'] }],
			),
			country('cuban', 'CU', 'meat', [
				'cuban',
				'ropa vieja',
				'picadillo',
				'mojo',
			]),
			country('puerto rican', 'PR', 'plantain', [
				'puerto rican',
				'mofongo',
				'pernil',
				'arroz con gandules',
			]),
			country('dominican', 'DO', 'plantain', [
				'dominican',
				'sancocho',
				'mangu',
			]),
			country('haitian', 'HT', 'meat', ['haitian', 'griot', 'pikliz']),
			country('trinidadian', 'TT', 'chili-pepper', [
				'trinidadian',
				'trini',
				'pelau',
			]),
			country('barbadian', 'BB', 'fish', ['barbadian', 'bajan', 'cou cou']),
			country('bahamian', 'BS', 'shrimp', ['bahamian', 'conch']),
			country('grenadian', 'GD', 'nutmeg', ['grenadian', 'oil down']),
			country('st lucian', 'LC', 'plantain', ['st lucian', 'saint lucian']),
			country('antiguan', 'AG', 'fish', ['antiguan']),
			country('curacaoan', 'CW', 'cheese', [
				'curacaoan',
				'curacao',
				'keshi yena',
			]),
			country('guadeloupean', 'GP', 'fish', ['guadeloupean', 'colombo']),
			country('martinican', 'MQ', 'fish', ['martinican']),
		],
	},
	{
		name: 'north american',
		sprite: 'corn',
		words: ['north american'],
		flavors: [],
		countries: [
			country(
				'american',
				'US',
				'corn',
				[
					'southern',
					'gumbo',
					'jambalaya',
					'etouffee',
					'po boy',
					'grits',
					'fried chicken',
					'hush puppies',
					'tex mex',
					'hawaiian',
					'poke',
					'meatloaf',
					'pot roast',
					'sloppy joe',
					'mac and cheese',
				],
				[
					{
						name: 'cajun',
						sprite: 'dried-chilies',
						words: ['cajun', 'creole', 'blackened'],
					},
					{
						name: 'barbecue',
						sprite: 'sauce',
						words: ['bbq', 'barbecue', 'barbecued'],
					},
					{ name: 'buffalo', sprite: 'chili-pepper', words: ['buffalo'] },
				],
			),
			country('canadian', 'CA', 'potato', ['canadian', 'poutine', 'tourtiere']),
		],
	},
	{
		name: 'central asian',
		words: ['central asian', 'silk road', 'plov', 'lagman', 'manti', 'samsa'],
		sprite: 'meat',
		flavors: [],
		countries: [
			country('uzbek', 'UZ', 'rice', ['uzbek', 'uzbekistani']),
			country('kazakh', 'KZ', 'meat', ['kazakh', 'beshbarmak']),
			country('kyrgyz', 'KG', 'meat', ['kyrgyz']),
			country('tajik', 'TJ', 'rice', ['tajik', 'qurutob']),
			country('turkmen', 'TM', 'meat', ['turkmen']),
		],
	},
	{
		name: 'central african',
		words: ['central african'],
		sprite: 'plantain',
		flavors: [],
		countries: [
			country('cameroonian', 'CM', 'plantain', ['cameroonian', 'ndole']),
			country('congolese', 'CD', 'kale', ['congolese', 'moambe', 'pondu']),
			country('gabonese', 'GA', 'fish', ['gabonese']),
			country('chadian', 'TD', 'beans', ['chadian']),
			country('central african republic', 'CF', 'plantain', [
				'central african republic',
			]),
		],
	},
	{
		name: 'balkan',
		words: ['balkan', 'cevapi', 'burek', 'ajvar', 'sarma', 'pljeskavica'],
		sprite: 'meat',
		flavors: [],
		countries: [
			country('croatian', 'HR', 'fish', ['croatian', 'peka']),
			country('serbian', 'RS', 'meat', ['serbian', 'karadordeva']),
			country('bosnian', 'BA', 'meat', ['bosnian', 'begova corba']),
			country('slovenian', 'SI', 'potato', ['slovenian', 'struklji']),
			country('albanian', 'AL', 'cheese', ['albanian', 'tave kosi', 'fergese']),
			country('bulgarian', 'BG', 'cheese', ['bulgarian', 'banitsa', 'shopska']),
			country('macedonian', 'MK', 'beans', ['macedonian', 'tavce gravce']),
			country('montenegrin', 'ME', 'meat', ['montenegrin']),
			country('kosovar', 'XK', 'meat', ['kosovar', 'flija']),
		],
	},
	{
		name: 'oceanian',
		words: ['oceanian', 'pacific islander', 'polynesian'],
		sprite: 'coconut-half',
		flavors: [],
		countries: [
			country('australian', 'AU', 'meat', [
				'australian',
				'aussie',
				'lamington',
				'meat pie',
				'sausage roll',
			]),
			country('new zealand', 'NZ', 'meat', ['new zealand', 'hangi', 'pavlova']),
			country('fijian', 'FJ', 'fish', ['fijian', 'kokoda']),
			country('samoan', 'WS', 'coconut-half', ['samoan', 'palusami', 'oka']),
			country('tongan', 'TO', 'coconut-half', ['tongan', 'lu pulu']),
			country('papua new guinean', 'PG', 'coconut-half', [
				'papua new guinean',
				'mumu',
			]),
			country('tahitian', 'PF', 'fish', ['tahitian', 'poisson cru']),
		],
	},
]

// Every cuisine one can pick: each region, then the countries in it.
export const cuisineParts: readonly (Part & {
	flavors: readonly Part[]
	region?: string
	flag?: string
})[] = cuisineRegions.flatMap(({ countries, ...region }) => [
	region,
	...countries.map((each) => ({ ...each, region: region.name })),
])

const cuisineNamed = new Map(cuisineParts.map((part) => [part.name, part]))

// Names an older tagging used, as they are called now.
const renamed = new Map([['american south', 'american']])

// A recipe's cuisines, each country with its region before it, so picking a
// region finds every country's dishes in it: ["middle eastern", "persian"].
export function placeCuisines(names: readonly string[]) {
	const placed = names.flatMap((name) => {
		const part = cuisineNamed.get(renamed.get(name) ?? name)

		return part ? [...(part.region ? [part.region] : []), part.name] : []
	})

	return [...new Set(placed)]
}

// The cuisine to show a recipe by: its country, with its flag, when it has
// one; its region alone when the dish belongs to the region as a whole.
export function cuisineTag(names: readonly string[]) {
	const parts = names.flatMap((name) => cuisineNamed.get(name) ?? [])
	const country = parts.find((part) => part.region)

	if (country) return { name: country.name, flag: country.flag }

	const region = parts[0]

	return region ? { name: region.name, flag: undefined } : undefined
}

// The kind of dish a title names, by its words, for a list to say: an entree
// unless it says otherwise.
const courses = [
	{
		name: 'drink',
		words: [
			'cocktail',
			'smoothie',
			'lemonade',
			'latte',
			'punch',
			'spritz',
			'margarita',
			'sangria',
			'juice',
			'milkshake',
			'mocktail',
			'hot chocolate',
			'chai',
		],
	},
	{
		name: 'dessert',
		words: [
			'cake',
			'cookie',
			'brownie',
			'tart',
			'cupcake',
			'pudding',
			'ice cream',
			'sorbet',
			'dessert',
			'fudge',
			'meringue',
			'cheesecake',
			'cobbler',
			'crumble',
			'mousse',
			'custard',
			'tiramisu',
			'pavlova',
			'truffle',
			'blondie',
			'galette',
			'muffin',
			'scone',
			'apple pie',
			'pecan pie',
			'pumpkin pie',
			'key lime pie',
			"s'mores",
		],
	},
	{
		name: 'snack',
		words: [
			'dip',
			'hummus',
			'popcorn',
			'chips',
			'bites',
			'energy balls',
			'side',
			'slaw',
			'coleslaw',
			'mashed',
			'fries',
			'pilaf',
			'roasted vegetables',
			'roast potatoes',
			'roasted potatoes',
			'garlic bread',
			'cornbread',
		],
	},
] as const

// Breakfast is when a dish is eaten, not what it is, so it goes beside its
// kind: a breakfast burrito is an entree, and breakfast.
const breakfastWords = [
	'breakfast',
	'pancake',
	'waffle',
	'oatmeal',
	'porridge',
	'granola',
	'french toast',
	'muffin',
	'scone',
	'overnight oats',
]

// How a dish is eaten: frozen, cool, or warm. Read from its words, then its
// kind: a meal is warm and a drink cool unless they say otherwise; a cake
// or a cookie is neither, at room temperature.
export const temperatures = ['frozen', 'cool', 'warm'] as const

const frozenWords = [
	'ice cream',
	'sorbet',
	'gelato',
	'popsicle',
	'ice pop',
	'semifreddo',
	'granita',
	'sherbet',
	'frozen',
	'nice cream',
	'affogato',
]

const coolWords = [
	'salad',
	'slaw',
	'coleslaw',
	'gazpacho',
	'ceviche',
	'sushi',
	'sashimi',
	'poke',
	'crudo',
	'tartare',
	'carpaccio',
	'chilled',
	'cold',
	'iced',
	'overnight oats',
	'parfait',
	'smoothie',
	'dip',
	'hummus',
	'tzatziki',
	'pickle',
	'pickles',
	'panna cotta',
	'cheesecake',
	'mousse',
	'no bake',
	'summer rolls',
]

const warmWords = [
	'hot',
	'warm',
	'mulled',
	'latte',
	'chai',
	'hot chocolate',
	'cocoa',
	'toddy',
	'tea',
	'pie',
	'crumble',
	'cobbler',
	'molten',
	'soup',
	'stew',
]

export function temperatureOf(title: string) {
	const text = normalize(title)

	if (mentions(text, frozenWords)) return 'frozen'

	// Said outright, it beats what the dish usually is: a warm potato salad.
	if (mentions(text, ['hot', 'warm', 'mulled'])) return 'warm'

	if (mentions(text, coolWords)) return 'cool'

	if (mentions(text, warmWords)) return 'warm'

	const [kind] = coursesOf(title)

	return kind === 'drink' ? 'cool' : kind === 'dessert' ? undefined : 'warm'
}

// Every kind, in the order a filter offers them: the meal first, then
// breakfast beside it.
export const courseNames = [
	'entree',
	'breakfast',
	'dessert',
	'drink',
	'snack',
] as const

// What a title is: its one kind (an entree unless it says otherwise), and
// breakfast too when it says so.
export function coursesOf(title: string) {
	const text = normalize(title)

	const kind =
		courses.find((course) => mentions(text, course.words))?.name ?? 'entree'

	return mentions(text, breakfastWords) ? [kind, 'breakfast'] : [kind]
}

// The main proteins, each opened to its cuts and kinds: chicken, then its
// thighs or breast. A title that names a cut is of its protein too.
type ProteinGroup = Part & { cuts: readonly Part[] }

export const proteinGroups: readonly ProteinGroup[] = [
	{
		name: 'fish',
		sprite: 'fish',
		words: ['fish', 'seafood'],
		cuts: [
			{ name: 'salmon', sprite: 'salmon', words: ['salmon'] },
			{ name: 'tuna', sprite: 'fish', words: ['tuna'] },
			{
				name: 'white fish',
				sprite: 'fish',
				words: [
					'cod',
					'halibut',
					'tilapia',
					'sea bass',
					'haddock',
					'snapper',
					'white fish',
					'mackerel',
					'trout',
				],
			},
			{
				name: 'shrimp',
				sprite: 'shrimp',
				words: ['shrimp', 'prawn', 'prawns'],
			},
			{
				name: 'shellfish',
				sprite: 'fish',
				words: [
					'scallop',
					'scallops',
					'mussels',
					'clams',
					'crab',
					'lobster',
					'oysters',
				],
			},
			{
				name: 'squid',
				sprite: 'fish',
				words: ['squid', 'calamari', 'octopus'],
			},
		],
	},
	{
		name: 'beef',
		sprite: 'steak',
		words: ['beef'],
		cuts: [
			{
				name: 'steak',
				sprite: 'steak',
				words: [
					'steak',
					'ribeye',
					'sirloin',
					'flank',
					'skirt steak',
					'strip steak',
					'filet mignon',
				],
			},
			{
				name: 'short rib',
				sprite: 'steak',
				words: ['short rib', 'short ribs', 'galbi'],
			},
			{ name: 'brisket', sprite: 'steak', words: ['brisket'] },
			{
				name: 'ground beef',
				sprite: 'steak',
				words: [
					'ground beef',
					'beef mince',
					'meatball',
					'meatballs',
					'bolognese',
					'meatloaf',
				],
			},
			{
				name: 'stew beef',
				sprite: 'steak',
				words: ['chuck', 'stew meat', 'beef stew', 'pot roast'],
			},
			{ name: 'oxtail', sprite: 'steak', words: ['oxtail'] },
			{ name: 'lamb', sprite: 'steak', words: ['lamb', 'mutton', 'kofta'] },
			{ name: 'bulgogi', sprite: 'steak', words: ['bulgogi'] },
		],
	},
	{
		name: 'chicken',
		sprite: 'chicken',
		words: ['chicken', 'poultry'],
		cuts: [
			{
				name: 'thighs',
				sprite: 'chicken',
				words: ['chicken thigh', 'chicken thighs', 'thighs'],
			},
			{
				name: 'breast',
				sprite: 'chicken',
				words: ['chicken breast', 'chicken breasts', 'breast'],
			},
			{ name: 'wings', sprite: 'chicken', words: ['wings', 'wing'] },
			{
				name: 'drumsticks',
				sprite: 'chicken',
				words: ['drumstick', 'drumsticks'],
			},
			{
				name: 'whole chicken',
				sprite: 'chicken',
				words: ['whole chicken', 'roast chicken', 'rotisserie'],
			},
			{ name: 'ground chicken', sprite: 'chicken', words: ['ground chicken'] },
			{ name: 'turkey', sprite: 'chicken', words: ['turkey'] },
		],
	},
	{
		name: 'pork',
		sprite: 'bacon',
		words: ['pork'],
		cuts: [
			{ name: 'pork belly', sprite: 'bacon', words: ['pork belly'] },
			{
				name: 'pork shoulder',
				sprite: 'bacon',
				words: ['pork shoulder', 'pulled pork', 'carnitas', 'char siu'],
			},
			{
				name: 'pork chops',
				sprite: 'bacon',
				words: ['pork chop', 'pork chops', 'tonkatsu'],
			},
			{ name: 'tenderloin', sprite: 'bacon', words: ['tenderloin'] },
			{
				name: 'ribs',
				sprite: 'bacon',
				words: ['ribs', 'spare ribs', 'baby back'],
			},
			{ name: 'bacon', sprite: 'bacon', words: ['bacon', 'pancetta'] },
			{
				name: 'sausage',
				sprite: 'sausage',
				words: ['sausage', 'sausages', 'chorizo', 'bratwurst', 'kielbasa'],
			},
			{ name: 'ham', sprite: 'bacon', words: ['ham', 'prosciutto'] },
			{ name: 'ground pork', sprite: 'bacon', words: ['ground pork'] },
			{ name: 'al pastor', sprite: 'bacon', words: ['al pastor'] },
		],
	},
	{
		name: 'vegetarian',
		sprite: 'broccoli',
		words: [
			'vegetable',
			'vegetables',
			'veggie',
			'veggies',
			'cauliflower',
			'eggplant',
		],
		cuts: [
			{ name: 'tofu', sprite: 'tofu', words: ['tofu', 'tempeh'] },
			{
				name: 'beans & lentils',
				sprite: 'beans',
				words: [
					'chickpea',
					'chickpeas',
					'lentil',
					'lentils',
					'black bean',
					'white bean',
					'beans',
					'dal',
					'dhal',
					'chana',
					'falafel',
				],
			},
			{
				name: 'mushrooms',
				sprite: 'mushroom',
				words: ['mushroom', 'mushrooms'],
			},
		],
	},
	{
		name: 'egg',
		sprite: 'egg',
		words: [
			'egg',
			'eggs',
			'frittata',
			'omelet',
			'omelette',
			'shakshuka',
			'quiche',
		],
		cuts: [],
	},
	{
		name: 'dairy',
		sprite: 'cheese',
		words: [
			'cheese',
			'mac and cheese',
			'yogurt',
			'ricotta',
			'burrata',
			'mozzarella',
			'feta',
		],
		cuts: [
			{ name: 'paneer', sprite: 'cheese', words: ['paneer'] },
			{ name: 'halloumi', sprite: 'cheese', words: ['halloumi'] },
		],
	},
]

// Every protein one can pick: each group, then the cuts in it.
export const proteinParts: readonly (Part & { region?: string })[] =
	proteinGroups.flatMap(({ cuts, ...group }) => [
		group,
		...cuts.map((cut) => ({ ...cut, region: group.name })),
	])

const proteinNamed = new Map(proteinParts.map((part) => [part.name, part]))

// Proteins as an older tagging named them, as they are known now.
const proteinRenamed = new Map([
	['white fish', 'white fish'],
	['eggs', 'egg'],
	['veggies', 'vegetarian'],
])

// A recipe's proteins, each cut with its protein before it, so picking
// chicken finds its thighs: ["chicken", "thighs"].
export function groupProteins(names: readonly string[]) {
	const placed = names.flatMap((name) => {
		const part = proteinNamed.get(proteinRenamed.get(name) ?? name)

		return part ? [...(part.region ? [part.region] : []), part.name] : []
	})

	return [...new Set(placed)]
}

// The protein a cut is of: "chicken" for thighs.
export const proteinGroupOf = (name: string) => proteinNamed.get(name)?.region

// The protein to show a recipe by: its cut when it names one, else its
// protein.
export const proteinTag = (names: readonly string[]) =>
	names.find((name) => proteinNamed.get(name)?.region) ?? names[0]

export const formParts = [
	{
		name: 'tacos',
		sprite: 'corn',
		words: ['taco', 'tacos', 'tostada', 'tostadas'],
	},
	{
		name: 'bowl',
		sprite: 'rice',
		words: ['bowl', 'bowls', 'bibimbap', 'donburi', 'poke', 'poké'],
	},
	{
		name: 'pasta',
		sprite: 'pasta',
		words: [
			'pasta',
			'spaghetti',
			'penne',
			'rigatoni',
			'linguine',
			'fettuccine',
			'tagliatelle',
			'pappardelle',
			'orzo',
			'macaroni',
			'mac and cheese',
			'lasagna',
			'lasagne',
			'gnocchi',
			'ravioli',
			'tortellini',
			'orecchiette',
			'bucatini',
			'carbonara',
		],
	},
	{
		name: 'noodles',
		sprite: 'pasta',
		words: [
			'noodle',
			'noodles',
			'ramen',
			'udon',
			'soba',
			'pho',
			'lo mein',
			'chow mein',
			'pad thai',
			'pad see ew',
			'japchae',
			'dan dan',
			'khao soi',
		],
	},
	{ name: 'salad', sprite: 'lettuce', words: ['salad', 'slaw'] },
	{
		name: 'sandwich',
		sprite: 'bread',
		words: [
			'sandwich',
			'sandwiches',
			'burger',
			'burgers',
			'banh mi',
			'po boy',
			'sliders',
			'sub',
			'melt',
			'toastie',
			'croque',
		],
	},
	{
		name: 'wrap',
		sprite: 'bread',
		words: [
			'wrap',
			'wraps',
			'burrito',
			'burritos',
			'gyro',
			'gyros',
			'pita',
			'flatbread',
			'quesadilla',
			'lettuce cups',
		],
	},
	{
		name: 'soup & stew',
		sprite: 'broth',
		words: [
			'soup',
			'stew',
			'chili',
			'chowder',
			'gumbo',
			'jjigae',
			'pozole',
			'bisque',
			'minestrone',
			'tom yum',
			'tom kha',
		],
	},
	{
		name: 'curry',
		sprite: 'cardamom-pods',
		words: [
			'curry',
			'curries',
			'korma',
			'vindaloo',
			'masala',
			'massaman',
			'panang',
			'jalfrezi',
			'rogan josh',
			'saag',
		],
	},
	{
		name: 'rice',
		sprite: 'rice',
		words: [
			'fried rice',
			'risotto',
			'paella',
			'biryani',
			'jambalaya',
			'pilaf',
			'pilau',
			'congee',
		],
	},
	{
		name: 'skewers',
		sprite: 'meat',
		words: [
			'skewer',
			'skewers',
			'kebab',
			'kebabs',
			'kabob',
			'souvlaki',
			'satay',
			'yakitori',
		],
	},
	{
		name: 'stir fry',
		sprite: 'broccoli',
		words: ['stir fry', 'stir-fry', 'stir fried', 'stir-fried'],
	},
	{
		name: 'sheet pan & roast',
		sprite: 'potato',
		words: [
			'sheet pan',
			'sheet-pan',
			'traybake',
			'tray bake',
			'roast',
			'roasted',
		],
	},
] as const satisfies readonly Part[]

// Recipes that are not a meal of these parts: sweets, drinks, and basics.
const notAMeal = [
	'cake',
	'cakes',
	'cookie',
	'cookies',
	'brownie',
	'brownies',
	'pie crust',
	'tart',
	'muffin',
	'muffins',
	'cupcake',
	'pudding',
	'ice cream',
	'sorbet',
	'cocktail',
	'smoothie',
	'frosting',
	'icing',
	'jam',
	'syrup',
	'dessert',
	'fudge',
	'meringue',
	'scone',
	'scones',
	'cheesecake',
	'cobbler',
	'crumble',
]

// What is picked in each bubble. Within a bubble any pick will do; across
// bubbles, every one must.
export type MealPicks = {
	cuisine?: readonly string[] | undefined
	protein?: readonly string[] | undefined
	form?: readonly string[] | undefined
}

export type MealTags = {
	cuisines: string[]
	flavors: string[]
	proteins: string[]
	forms: string[]
}

const normalize = (text: string) =>
	` ${text
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[’']/g, "'")
		.replace(/[^\p{L}\p{N}']+/gu, ' ')
		.trim()} `

// A word or phrase in a title, whole, with a plain plural allowed.
const mentions = (title: string, words: Words) =>
	words.some((word) => {
		const phrase = normalize(word).trim()

		return (
			title.includes(` ${phrase} `) ||
			title.includes(` ${phrase}s `) ||
			title.includes(` ${phrase}es `)
		)
	})

// The parts a recipe's title names. A flavor names its cuisine too.
const meatProteins = new Set(['fish', 'beef', 'chicken', 'pork'])

export function mealTags(title: string): MealTags | undefined {
	const text = normalize(title)

	if (mentions(text, notAMeal)) return undefined

	const flavors = cuisineParts.flatMap((cuisine) =>
		cuisine.flavors.flatMap((flavor) =>
			mentions(text, flavor.words) ? [flavor.name] : [],
		),
	)

	const cuisines = placeCuisines(
		cuisineParts.flatMap((cuisine) =>
			mentions(text, cuisine.words) ||
			cuisine.flavors.some((flavor) => flavors.includes(flavor.name))
				? [cuisine.name]
				: [],
		),
	)

	const named = (parts: readonly Part[]) =>
		parts.flatMap((part) => (mentions(text, part.words) ? [part.name] : []))

	const proteins = groupProteins(named(proteinParts))

	// "Chicken and vegetable stew" is chicken: a meat protein outweighs a
	// vegetable word, so the vegetarian pick never finds it.
	const meaty = proteins.some((name) => meatProteins.has(name))

	return {
		cuisines,
		flavors,
		proteins: meaty
			? proteins.filter(
					(name) =>
						name !== 'vegetarian' && proteinGroupOf(name) !== 'vegetarian',
				)
			: proteins,
		forms: named(formParts),
	}
}

// Nothing picked, or the tags hold one of the picks.
const anyOf = (picked: readonly string[] | undefined, held: string[]) =>
	!picked?.length || picked.some((name) => held.includes(name))

// A title's parts hold one pick from every bubble that has some.
export function fitsPicks(tags: MealTags, picks: MealPicks) {
	return (
		anyOf(picks.cuisine, tags.cuisines) &&
		anyOf(picks.protein, tags.proteins) &&
		anyOf(picks.form, tags.forms)
	)
}

export const hasPicks = (picks: MealPicks) =>
	Boolean(picks.cuisine?.length || picks.protein?.length || picks.form?.length)

export type PartCount = {
	name: string
	sprite: string
	count: number
	// For a country, the region it is in, and its flag.
	region?: string | undefined
	flag?: string | undefined
}

export type MealCounts = {
	total: number
	cuisines: PartCount[]
	proteins: PartCount[]
	forms: PartCount[]
}

// How many titles each option would leave, given the other picks: the counts
// a step shows are for changing that step alone. An option with none is kept,
// for the menu to show it greyed.
// Each top part, then the parts under it, the most found first.
const grouped = (parts: PartCount[]) =>
	parts
		.filter((part) => !part.region)
		.flatMap((top) => [
			top,
			...parts.filter((part) => part.region === top.name),
		])

export function countParts(
	tagged: readonly MealTags[],
	picks: MealPicks,
): MealCounts {
	const tally = (
		parts: readonly {
			name: string
			sprite: string
			region?: string | undefined
			flag?: string | undefined
		}[],
		without: MealPicks,
		has: (tags: MealTags, name: string) => boolean,
	) => {
		const counts = new Map<string, number>()

		for (const tags of tagged)
			if (fitsPicks(tags, without))
				for (const part of parts)
					if (has(tags, part.name))
						counts.set(part.name, (counts.get(part.name) ?? 0) + 1)

		return parts
			.flatMap((part) => {
				const count = counts.get(part.name) ?? 0

				// Every option stays, so a menu keeps its shape; one that would
				// leave nothing says so by its count.
				return [
					{
						name: part.name,
						sprite: part.sprite,
						count,
						region: part.region,
						flag: part.flag,
					},
				]
			})
			.sort((a, b) => b.count - a.count)
	}

	const cuisines = tally(
		cuisineParts,
		{ ...picks, cuisine: undefined },
		(tags, name) => tags.cuisines.includes(name),
	)

	return {
		total: tagged.filter((tags) => fitsPicks(tags, picks)).length,
		// Each region, then the countries in it, the most found first.
		cuisines: grouped(cuisines),
		proteins: grouped(
			tally(proteinParts, { ...picks, protein: undefined }, (tags, name) =>
				tags.proteins.includes(name),
			),
		),
		forms: tally(formParts, { ...picks, form: undefined }, (tags, name) =>
			tags.forms.includes(name),
		),
	}
}
