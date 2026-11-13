-- A shelf for the benchmark's account (scripts/bench.ts creates it on its
-- first run): twelve finished recipes, each with ten ingredients and six steps.
-- Safe to run again.
do $$
declare
	uid text := (select id from "user" where email = 'bench@cocochef.test');
	titles text[] := array['lentil soup', 'chicken tikka masala', 'pad thai',
		'beef stew', 'mushroom risotto', 'banana bread', 'shakshuka', 'bibimbap',
		'margherita pizza', 'caesar salad', 'pork dumplings', 'lemon tart'];
	ingredients text[] := array['2 tbsp olive oil', '1 onion, diced',
		'3 cloves garlic', '400g tinned tomatoes', '1 tsp cumin', '500ml stock',
		'1 lemon', 'salt and pepper', 'handful of parsley', '200g rice'];
	recipe text;
begin
	if uid is null then
		raise exception 'no bench account yet: run `vp run bench <url>` once first';
	end if;

	for i in 1..12 loop
		recipe := 'bench-recipe-' || i;

		insert into recipes (id, user_id, title, servings, total_minutes, created_at, finalized_at)
		values (recipe, uid, titles[i], 4, 30 + i * 5, now() - i * interval '1 day', now() - i * interval '1 day')
		on conflict (id) do nothing;

		insert into shelf_recipes (id, user_id, recipe_id, added_at)
		values ('bench-shelf-' || i, uid, recipe, now() - i * interval '1 day')
		on conflict (id) do nothing;

		for j in 1..10 loop
			insert into recipe_ingredients (id, recipe_id, position, text)
			values (recipe || '-i' || j, recipe, j - 1, ingredients[j])
			on conflict (id) do nothing;
		end loop;

		for j in 1..6 loop
			insert into recipe_steps (id, recipe_id, position, text)
			values (recipe || '-s' || j, recipe, j - 1,
				'stir everything together and cook gently until it smells wonderful, about ten minutes.')
			on conflict (id) do nothing;
		end loop;
	end loop;
end $$;
