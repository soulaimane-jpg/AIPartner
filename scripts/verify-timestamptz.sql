-- Post-migration verification for 20260812_timestamptz.sql.
--
--   psql "$DB_URL" -f scripts/verify-timestamptz.sql
--
-- Expected: `remaining_naive` = 0 and `timestamptz_columns` = the count
-- reported by the migration's NOTICE (plus _migration.appliedAt).

\pset pager off

SELECT
    COUNT(*) FILTER (WHERE data_type = 'timestamp without time zone')
        AS remaining_naive,
    COUNT(*) FILTER (WHERE data_type = 'timestamp with time zone')
        AS timestamptz_columns
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema
   AND t.table_name   = c.table_name
   AND t.table_type   = 'BASE TABLE'
 WHERE c.table_schema = 'public'
   AND c.data_type LIKE 'timestamp%';

-- Anything still naive, named explicitly.
SELECT c.table_name, c.column_name
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema
   AND t.table_name   = c.table_name
   AND t.table_type   = 'BASE TABLE'
 WHERE c.table_schema = 'public'
   AND c.data_type = 'timestamp without time zone'
 ORDER BY 1, 2;

-- Sanity: the most recent migration should be timestamped near now. A
-- non-UTC writer shows up here as a ~hours-wide offset.
--
-- Guarded because `_migration` is created by scripts/migrate.sh and is
-- absent on a freshly-loaded schema (e.g. a rehearsal database); a
-- verification script must not error just because it ran early.
DO $$
DECLARE recent boolean;
BEGIN
    IF to_regclass('public."_migration"') IS NULL THEN
        RAISE NOTICE 'clock check skipped: _migration not present';
        RETURN;
    END IF;
    EXECUTE 'SELECT MAX(ABS(EXTRACT(EPOCH FROM (NOW() - "appliedAt")))) < 86400
               FROM "_migration"' INTO recent;
    RAISE NOTICE 'migration clock within 24h: %', COALESCE(recent::text, 'no rows');
END $$;
