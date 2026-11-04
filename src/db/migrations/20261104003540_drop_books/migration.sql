ALTER TABLE "shelf_recipes" DROP CONSTRAINT "shelf_recipes_collection_id_fk";--> statement-breakpoint
DROP TABLE "collections";--> statement-breakpoint
DROP INDEX "shelf_recipes_collection_id_index";--> statement-breakpoint
ALTER TABLE "shelf_recipes" DROP COLUMN "collection_id";