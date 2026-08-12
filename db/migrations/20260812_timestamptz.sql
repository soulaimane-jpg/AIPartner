-- Convert every naive TIMESTAMP(3) column to timestamptz.
--
-- WHY
-- Every timestamp in the schema was `timestamp without time zone`, with
-- the driver appending `Z` at parse time (src/lib/db/index.ts) so the
-- whole system is UTC *by convention*. One writer that isn't — a
-- migration, a script, a managed-service default, a psql session in a
-- local timezone — is undetectable and silently shifts deadlines. The
-- SLA timers, T1/T2 windows and acceptance evidence all hang off these
-- columns. `_migration.appliedAt` in scripts/migrate.sh was already
-- timestamptz, so the right type was clearly known.
--
-- LOCKING — read this before running
-- On PostgreSQL 12+ (this instance is POSTGRES_16), converting
-- timestamp -> timestamptz is a metadata-only change that AVOIDS a table
-- rewrite **when the session TimeZone is UTC**, because the stored bytes
-- are already the UTC representation. `SET LOCAL TimeZone = 'UTC'` below
-- is therefore load-bearing, not decoration: without it this becomes a
-- full rewrite of 219 columns across 72 tables.
--
-- Each ALTER still takes a brief ACCESS EXCLUSIVE lock, so run it in a
-- quiet window. `lock_timeout` keeps a blocked ALTER from queueing behind
-- a long transaction and stalling every reader of that table.
--
-- ROLLBACK: db/migrations/rollback/20260812_timestamptz_down.sql
--
-- VERIFY AFTER: scripts/verify-timestamptz.sql

BEGIN;

-- Load-bearing: makes the conversion a no-rewrite metadata change.
SET LOCAL TimeZone = 'UTC';
-- Don't queue behind a long-running transaction holding the table.
SET LOCAL lock_timeout = '15s';
-- A stuck statement should fail the migration, not hang the deploy.
SET LOCAL statement_timeout = '15min';

DO $$
DECLARE
    r          RECORD;
    converted  INTEGER := 0;
BEGIN
    -- Driven off the live catalog rather than a hardcoded column list, so
    -- the migration cannot drift from the schema it is fixing.
    FOR r IN
        SELECT c.table_name, c.column_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema
           AND t.table_name   = c.table_name
           AND t.table_type   = 'BASE TABLE'
         WHERE c.table_schema = 'public'
           AND c.data_type    = 'timestamp without time zone'
         ORDER BY c.table_name, c.ordinal_position
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            r.table_name, r.column_name, r.column_name
        );
        converted := converted + 1;
    END LOOP;

    RAISE NOTICE 'timestamptz: converted % column(s)', converted;
END $$;

COMMIT;

-- Defaults referencing CURRENT_TIMESTAMP remain correct: it returns
-- timestamptz, which previously underwent an implicit cast to the naive
-- type and now needs none.
