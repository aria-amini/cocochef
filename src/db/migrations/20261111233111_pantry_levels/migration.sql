ALTER TABLE "pantry_items" ADD COLUMN "level" text DEFAULT 'plenty' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD COLUMN "bought_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_items" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
-- Every ingredient was added one at a time: a lone 1 says nothing about how
-- much is left, so only a real count is kept.
UPDATE "pantry_items" SET "quantity" = NULL WHERE "quantity" = 1;
