CREATE TABLE "recipe_ai_versions" (
	"user_id" text NOT NULL,
	"original_id" text NOT NULL,
	"cleaned_id" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_ai_versions_user_original" ON "recipe_ai_versions" ("user_id","original_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_ai_versions_cleaned" ON "recipe_ai_versions" ("cleaned_id");--> statement-breakpoint
ALTER TABLE "recipe_ai_versions" ADD CONSTRAINT "recipe_ai_versions_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recipe_ai_versions" ADD CONSTRAINT "recipe_ai_versions_original_id_recipes_id_fkey" FOREIGN KEY ("original_id") REFERENCES "recipes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recipe_ai_versions" ADD CONSTRAINT "recipe_ai_versions_cleaned_id_recipes_id_fkey" FOREIGN KEY ("cleaned_id") REFERENCES "recipes"("id") ON DELETE CASCADE;