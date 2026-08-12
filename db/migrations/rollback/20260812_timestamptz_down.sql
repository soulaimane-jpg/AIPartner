-- Rollback for 20260812_timestamptz.sql.
--
-- Converts every timestamptz column in `public` back to naive
-- TIMESTAMP(3), interpreting values as UTC — the inverse of the forward
-- migration, and lossless because the application only ever wrote UTC.
--
-- As with the forward migration, `SET LOCAL TimeZone = 'UTC'` keeps this
-- a metadata-only change on PostgreSQL 12+ instead of a table rewrite.
--
-- NOTE: this is deliberately NOT registered in the `_migration` table.
-- Run it by hand, then delete the forward migration's row:
--
--   psql "$DB_URL" -f db/migrations/rollback/20260812_timestamptz_down.sql
--   psql "$DB_URL" -c 'DELETE FROM "_migration" WHERE "filename" = ''20260812_timestamptz.sql'''

BEGIN;

SET LOCAL TimeZone = 'UTC';
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '15min';

DO $$
DECLARE
    r         RECORD;
    reverted  INTEGER := 0;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
           AND t.table_name   = c.table_name
           AND t.table_type   = 'BASE TABLE'
         WHERE c.table_schema = 'public'
           AND c.data_type    = 'timestamp with time zone'
           -- `_migration.appliedAt` was timestamptz before this change
           -- and must stay that way.
           AND NOT (c.table_name = '_migration' AND c.column_name = 'appliedAt')
         ORDER BY c.table_name, c.ordinal_position
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamp(3) USING %I AT TIME ZONE ''UTC''',
            r.table_name, r.column_name, r.column_name
        );
        reverted := reverted + 1;
    END LOOP;

    RAISE NOTICE 'timestamptz rollback: reverted % column(s)', reverted;
END $$;

COMMIT;
