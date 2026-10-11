# Database changes applied by hand

The live database has a few old differences from `prisma/schema.prisma` (see
"Schema drift" in [`docs/ROADMAP.md`](../../docs/ROADMAP.md)), so
`prisma db push` can't be used on production: it would try to change or drop
things that aren't ours to change. Each new table or column is added with a
small SQL file instead. Every file here was applied on production on the
date in its name.

## How to apply a new change

1. Change `prisma/schema.prisma`, run the tests (the test database is updated
   with `prisma db push`, which is fine there).
2. On the server, after `git pull`, preview what Prisma would change:
   ```
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
   ```
3. Copy **only the statements for your change** into a new file here,
   `YYYY-MM-DD-<sprint>-<what>.sql`, wrapped like the others:
   ```
   \set ON_ERROR_STOP on
   BEGIN;
   SET ROLE apptmasters;   -- new tables must belong to the app's account
   ...
   COMMIT;
   ```
4. Apply it as the `postgres` user against the app's database, then run the
   preview again: your change should no longer appear in it.
5. Check new tables belong to `apptmasters`:
   ```
   select tablename, tableowner from pg_tables where schemaname = 'public' and tableowner <> 'apptmasters';
   ```
6. Run `npx prisma generate` before building.

Never use `--accept-data-loss`.
