CREATE TABLE "cooking_progress" (
	"user_id" text,
	"recipe_id" text,
	"active" boolean NOT NULL,
	"checked" text[] NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cooking_progress_pkey" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
ALTER TABLE "cooking_progress" ADD CONSTRAINT "cooking_progress_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cooking_progress" ADD CONSTRAINT "cooking_progress_recipe_id_recipes_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE;