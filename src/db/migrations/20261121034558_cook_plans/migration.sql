CREATE TABLE "cook_plans" (
	"user_id" text,
	"recipe_id" text,
	"skipped" text[] NOT NULL,
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cook_plans_pkey" PRIMARY KEY("user_id","recipe_id")
);
--> statement-breakpoint
ALTER TABLE "cook_plans" ADD CONSTRAINT "cook_plans_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cook_plans" ADD CONSTRAINT "cook_plans_recipe_id_recipes_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE;