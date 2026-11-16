CREATE TABLE "grocery_item_recipes" (
	"item_id" text,
	"recipe_id" text,
	CONSTRAINT "grocery_item_recipes_pkey" PRIMARY KEY("item_id","recipe_id")
);
--> statement-breakpoint
CREATE INDEX "grocery_item_recipes_recipe_id_index" ON "grocery_item_recipes" ("recipe_id");--> statement-breakpoint
ALTER TABLE "grocery_item_recipes" ADD CONSTRAINT "grocery_item_recipes_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "grocery_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "grocery_item_recipes" ADD CONSTRAINT "grocery_item_recipes_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "grocery_item_recipes" ("item_id", "recipe_id") SELECT "id", "recipe_id" FROM "grocery_items" WHERE "recipe_id" IS NOT NULL ON CONFLICT DO NOTHING;
