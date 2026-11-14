// Extensions test containers create before seeding
// (tests/support/db.global-setup.ts). drizzle-kit never emits CREATE
// EXTENSION, so a migration that needs one adds it by hand, as
// 20261114190121_search_trigram_indexes does for pg_trgm.
export const REQUIRED_EXTENSIONS = ['pg_trgm', 'citext'] as const
