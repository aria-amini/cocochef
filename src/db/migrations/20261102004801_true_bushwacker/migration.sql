CREATE TABLE "recipe_shares" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"slug" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharing_profiles" (
	"user_id" text PRIMARY KEY,
	"handle" text NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"auto_publish" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_recipe_links" (
	"recipe_id" text PRIMARY KEY,
	"site" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_shares_user_recipe_index" ON "recipe_shares" ("user_id","recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_shares_user_slug_index" ON "recipe_shares" ("user_id","slug");--> statement-breakpoint
CREATE INDEX "recipe_shares_recipe_index" ON "recipe_shares" ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "web_recipe_links_site_slug_index" ON "web_recipe_links" ("site","slug");--> statement-breakpoint
ALTER TABLE "recipe_shares" ADD CONSTRAINT "recipe_shares_profile_fk" FOREIGN KEY ("user_id") REFERENCES "sharing_profiles"("user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recipe_shares" ADD CONSTRAINT "recipe_shares_recipe_fk" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sharing_profiles" ADD CONSTRAINT "sharing_profiles_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "web_recipe_links" ADD CONSTRAINT "web_recipe_links_recipe_id_recipes_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE;