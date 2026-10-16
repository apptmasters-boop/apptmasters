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

### The developer PC's test database

On the developer's Windows PC the test server is a separate Postgres 16
instance on port 5433, with trust login for `postgres` and two databases:
`apptmasters_test` (the suite) and `apptmasters_live` (local preview, sample
listings in `fixtures/local-preview-seed.sql`). Its data folder is
`C:\Users\selle\develop\pgdata\apptmasters-test`. Start it with:
```
"C:\Program Files\PostgreSQL\16\bin\pg_ctl" -D C:\Users\selle\develop\pgdata\apptmasters-test -l C:\Users\selle\develop\pgdata\apptmasters-test.log -o "-p 5433" start
```

**Incident, 2026-10-10:** the data folder used to live in a Windows temp
folder. Windows' overnight temp cleanup deleted some of its files, and the
suite then hung at start-up (the log showed `could not open file
"global/6100"`). It only held test data, so it was recreated from scratch;
the live site was not affected. The folder was then moved out of the temp
area to the location above. If it ever happens again, nothing is lost:
```
initdb -D <folder> -U postgres -A trust -E UTF8
pg_ctl -D <folder> -o "-p 5433" start
psql -p 5433 -U postgres -c "create database apptmasters_test"
```
The suite recreates all tables itself on the next `npm test`.

**It grows with every run** (tests add data and never delete it). On
2026-10-16, with about 4,500 test households, the site-wide "Money check"
report test took over 20 seconds and timed out. When tests start timing out
locally but pass on GitHub (which starts from an empty database), recreate it:
```
psql -h localhost -p 5433 -U postgres -d postgres -c "DROP DATABASE apptmasters_test WITH (FORCE)"
psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE apptmasters_test"
```
Stop the local app on port 3100 first; afterwards re-run the screenshot seed
scripts (`scripts/dev/screenshots/`).

## Writing a test

- Build data with the helpers in `helpers.ts` (`createUser`, `createApartment`)
  and requests with `request(path, { method, token, body })`.
- Assert on status codes and on what must **not** be in a response (passwords,
  other people's emails), not just on what should be there.

## Known gaps (`it.fails`)

A test written with `it.fails` documents a bug we know about but have not
fixed yet: it passes while the bug exists. When you fix the bug, that test
starts failing; change it to a plain `it` so the fix stays protected. There
are none right now; open security work is listed in `docs/ROADMAP.md`.
