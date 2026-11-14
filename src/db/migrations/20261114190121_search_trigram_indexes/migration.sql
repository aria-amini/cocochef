CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_ingredients_text_trgm_index" ON "recipe_ingredients" USING gin ("text" gin_trgm_ops);
