-- Guest accounts are gone: everything that saves needs a real account. Guests
-- are deleted with what they kept, which every foreign key to "user" cascades.
DELETE FROM "user" WHERE "is_anonymous";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_anonymous";
