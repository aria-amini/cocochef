-- Guest accounts are gone: everything that saves needs a real account. Guests
-- are deleted with what they kept, which every foreign key to "user" cascades.
-- Safe to run again where the column is already gone.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'user' AND column_name = 'is_anonymous'
	) THEN
		DELETE FROM "user" WHERE "is_anonymous";
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "is_anonymous";
