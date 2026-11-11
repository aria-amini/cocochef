CREATE TABLE "meal_tags" (
	"key" text PRIMARY KEY,
	"meal" boolean NOT NULL,
	"cuisines" text[] DEFAULT '{}'::text[] NOT NULL,
	"flavors" text[] DEFAULT '{}'::text[] NOT NULL,
	"proteins" text[] DEFAULT '{}'::text[] NOT NULL,
	"forms" text[] DEFAULT '{}'::text[] NOT NULL,
	"model" text NOT NULL,
	"tagged_at" timestamp with time zone NOT NULL
);
