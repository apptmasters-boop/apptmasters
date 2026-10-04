# Tests

API tests call the route handlers in `src/app/api` directly, the same
functions Next.js runs in production, against a real Postgres database. They
check behaviour that matters to users and to security: who can sign in, who
can see which data, what gets stored.

## Running locally

1. Have a Postgres server you can create databases on, and create a database
   whose **name contains `test`** (the suite refuses to run otherwise):
   ```
   createdb apptmasters_test
   ```
2. Point the suite at it if it is not the default
   (`postgresql://postgres@localhost:5433/apptmasters_test`):
   ```
   set TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/apptmasters_test
   ```
3. Run:
   ```
   npm test
   ```

The suite updates the test database's tables to match `prisma/schema.prisma`
before it starts (non-destructive `prisma db push`). Tests never assume the
database is empty: each one creates its own uniquely named data.

Email is replaced by a no-op (see `setup-env.ts`), so tests never send mail.

## Writing a test

- Build data with the helpers in `helpers.ts` (`createUser`, `createApartment`)
  and requests with `request(path, { method, token, body })`.
- Assert on status codes and on what must **not** be in a response (passwords,
  other people's emails), not just on what should be there.

## Known gaps (`it.fails`)

A test written with `it.fails` documents a bug we know about but have not
fixed yet: it passes while the bug exists. When you fix the bug, that test
starts failing; change it to a plain `it` so the fix stays protected. Current
gaps are listed under Phase 1 in `docs/ROADMAP.md`.
