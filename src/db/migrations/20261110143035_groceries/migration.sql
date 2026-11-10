CREATE TABLE "grocery_items" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"category" text NOT NULL,
	"recipe_id" text,
	"recipe_title" text,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "grocery_items_user_id_index" ON "grocery_items" ("user_id");--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL;