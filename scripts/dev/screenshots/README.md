# Screenshots of the local app

Each Sprint 13 step is checked by putting the screens next to the owner's
pictures in [`docs/mockups/`](../../../docs/mockups/) at phone (390 px) and
desktop (1536 px) size before it ships. These scripts make those
screenshots from a **local** copy of the app against the **test** database,
with made-up people and listings. They never touch the live site.

## One-time setup on a PC

1. The local test database is running (see [`tests/README.md`](../../../tests/README.md))
   and `npm test` has run once, so its tables exist.
2. Google Chrome is installed. If it's not at
   `C:/Program Files/Google/Chrome/Application/chrome.exe`, set `CHROME_PATH`.
   (Microsoft Edge in headless mode failed on the developer PC.)
3. In this folder: `npm install` (only puppeteer-core; separate from the app).

## Each time

1. Fill the test database with the made-up data (re-runnable):
   ```bash
   node scripts/dev/screenshots/seed-people.mjs
   node scripts/dev/screenshots/seed-marketplace.mjs
   ```
2. Start the local app on port 3100 with a throwaway sign-in secret
   (from the repository root; the database URL is the one in `tests/test-db.ts`):
   ```bash
   DATABASE_URL=postgresql://postgres@localhost:5433/apptmasters_test JWT_SECRET=shots-local-secret RESEND_API_KEY=re_your_disabled npx next dev -p 3100
   ```
   Stop it before running `next build` on the same PC (they share `.next`). If
   pages answer 500 with "Jest worker … exceeding retry limit", stop it, delete
   `.next/dev` and start it again.
3. Take the screenshots (all, or only some by name):
   ```bash
   cd scripts/dev/screenshots
   node shots.mjs out13b                 # everything
   node shots.mjs out13b home visitor    # only Home, signed in and signed out
   ```
   Names: `visitor`, `home`, `results`, `details`, `saved`, `inbox`, `thread`,
   `more`, `how`, `help`, `mine`, `household`. Files end in `-m` (phone) or `-d`
   (desktop). The `out*` folders and the browser `profile` are not committed.

The people: Jordan Lee (`shot-me`, looking for a home: the signed-in shots),
Sarah Miller (`shot-owner`, the advertiser) and Alex Kim (`shot-admin`, a member
of the household "Prospect Park Place", `shot-home`: the household shots).
