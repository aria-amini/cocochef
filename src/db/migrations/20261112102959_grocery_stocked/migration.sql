ALTER TABLE "grocery_items" ADD COLUMN "stocked_id" text;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD COLUMN "stocked_was" jsonb;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_stocked_id_fk" FOREIGN KEY ("stocked_id") REFERENCES "pantry_items"("id") ON DELETE SET NULL;