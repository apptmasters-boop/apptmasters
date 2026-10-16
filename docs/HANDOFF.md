# Where we continue

**Updated 2026-10-16, end of day.** Read this first, on any PC. Notes that
Claude Code keeps on one PC don't move to another PC; this file does.

**On a new PC, tell Claude Code:** "Read `docs/HANDOFF.md` and continue
from there."

## Right now

- **Approved:** 13a (the pictures' font and frame everywhere), on 2026-10-16.
  The owner's reply was "13b approved", read as 13a approved and the go-ahead
  for 13b.
- **Approved:** 13b (Home), 13c (Search results) and 13d (Filters + 4 new
  details, with its database change applied), on 2026-10-16.
- **Live on apptmasters.com:** Sprint **13e — Listing page** (photo across the
  top, green price, facts in 3 columns with the size, amenities with icons, the
  neighborhood card, the advertiser's photo; on desktop a card that stays in
  view). Commit `667bf78`.
- **Next step:** the owner tests 13e (steps in
  [`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md), "13e — Listing page") and
  replies **"13e approved"** (or lists what's wrong). Then build **13f —
  Saved**, following [`SPRINT_13_PLAN.md`](SPRINT_13_PLAN.md).
- **The rule for Sprint 13:** one step at a time. Each step is built,
  compared with the owner's picture in [`mockups/`](mockups/) at phone and
  desktop size, checked, deployed, and tested by the owner. The next step
  starts only after the owner approves.

## Sprint 13 steps

| Step | What | Status |
|---|---|---|
| 13a | The look everywhere: font, green phone bar, phone logo bar on Home only, full-width desktop header | Approved 2026-10-16 |
| 13b | Home: headline, search, quick pickers (Price, Bedrooms, Move-in date), "Already have a place?", listing tiles | Approved 2026-10-16 |
| 13c | Search results: phone title bar, chip row, All/Apartments/Rooms/Houses tabs, cards as in the picture; desktop cards with the advertiser's photo; move the "Have you found your new home?" card to Home only | Approved 2026-10-16 |
| 13d | Filters as in the picture + 4 new listing details (air conditioning, heat included, dishwasher, square feet). **Needs a database change: ask the owner's OK before applying it on the live site** | Approved 2026-10-16 (database change applied) |
| 13e | Listing page | Live, waiting for the owner's test |
| 13f | Saved | |
| 13g | Messages (photos, conversation without the phone bar, desktop three panels) | |
| 13h | More, How It Works, Help, Create / Join a Home | |

Owner decisions: the new look on the **whole app**; **profile photos** shown
when a person added one; the **4 new details** added. Left out because the
app doesn't have them: ratings, "verified" badges (other than "Email
confirmed"), online status, calls, "Schedule viewing", photos and voice in
marketplace messages, folders, saved searches, nearby places.

## Waiting for the owner

- **Tests / sign-offs:** 11a ("Have you found your new home?"), 11b (Create /
  Join a Home), 12a–12e (Find a Home), 13e. Sprints 1–10 and 13a–13d are
  approved.
- **Daily "Have you found your new home?" email:** needs the owner's OK to add
  the server's daily job (`0 14 * * *`, 10 am New York, calling
  `/api/cron/home-search`). It's a server configuration change, so ask first.
- **Map service** for 12f (map and radius search), plus Search history and
  the notification bell for people without a home.
- **After the owner's 11a test:** put test accounts A and B's real sign-up
  dates back. On the server, run the file
  `~/backups/2026-10-16/restore-test-signup-dates.sql` with
  `sudo -u postgres psql -d <database> -f <file>`.
- **The 3 live listings** don't say how many people can live there yet;
  their owners should edit them (a "People" search skips them until then).
- **Open questions:** keep or remove the SSH key named
  `claude-code-apptmasters` on the server; the friend's GitHub username (to
  invite them); the friend's own SSH key instead of sharing `appmasters.pem`;
  the server size (1 GB, it swaps during builds).
- **Before public launch** (see [`ROADMAP.md`](ROADMAP.md)): nightly backups
  first, an AWS budget alert, `.env.local` in a password manager, signing out
  other sessions on a password change.

## How we work (always)

- One phase or step at a time: plan and test steps in `BUILD_CHECKLIST.md`
  first, then build, run the checks, deploy, and the owner tests and signs
  off.
- Push to GitHub at the end of every working day.
- **Live database:** never `prisma db push`, never `--accept-data-loss`. Each
  change is a reviewed SQL file in [`prisma/manual-sql/`](../prisma/manual-sql/),
  applied **only after the owner's explicit yes**.
- Ask the owner before any server configuration change (scheduled jobs,
  nginx, firewall, SSH keys) and before deleting anything that can't be
  rebuilt.
- On the live database, look at counts only; never print people's personal
  data or sign-in tokens.
- Never commit `.env.local` or `*.pem` files.

## Setting up a new PC

1. Install Git, Node.js 20, PostgreSQL 16, Google Chrome and the GitHub CLI.
   Sign in with `gh auth login` (the `apptmasters-boop` account; the
   repository is private).
2. `gh repo clone apptmasters-boop/apptmasters`, then `npm install` in it.
3. **Test database:** follow [`tests/README.md`](../tests/README.md) (a
   Postgres on port 5433 with a database named `apptmasters_test`). Then
   check everything works: `npm run typecheck`, `npm test` (288 tests),
   `npm run lint:ratchet` (51 errors allowed).
4. **Screenshots** for comparing with the pictures:
   [`scripts/dev/screenshots/README.md`](../scripts/dev/screenshots/README.md).
5. **`.env.local`** (passwords and keys) is not in GitHub. It's only needed
   to run the app against a real database; tests and screenshots don't need
   it. The owner keeps a copy (password manager).
6. **Deploying** needs two things that aren't in GitHub:
   - **The key:** the SSH key file `appmasters.pem` goes in `~/.ssh/`. The
     server is
     `ssh -i ~/.ssh/appmasters.pem ubuntu@ec2-44-192-72-84.compute-1.amazonaws.com`.
     Use that name, not the IP, or the host-key check fails.
   - **Your network:** AWS only accepts SSH from listed internet addresses.
     On a new network, the owner adds it first: AWS console → EC2 → the
     instance → Security → the security group → Edit inbound rules → add an
     SSH rule for "My IP", keeping the existing rows. Without that, SSH just
     times out while the website keeps working.

## Deploying (summary; the full recipe is in [`README.md`](../README.md#deploy))

1. Locally run `npm run typecheck`, `npm test` and `npm run lint:ratchet`,
   then push and wait for CI: `gh run watch <id> --exit-status`.
2. On the server, in `/var/www/apptmasters`:
   1. `git checkout -- package-lock.json && git pull --ff-only origin master`.
   2. If there's a new SQL file: preview it with
      `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`,
      **get the owner's yes**, apply it with `sudo -u postgres psql -d <db> -f <file>`,
      check the new table belongs to `apptmasters`, then run
      `npx prisma generate`.
   3. `rm -rf .next/cache/turbopack`. Its saved build files kept the old
      font on 2026-10-16.
   4. `nohup sh -c "SKIP_BUILD_TYPECHECK=1 npm run build > /tmp/build.log 2>&1; echo EXIT=\$? >> /tmp/build.log" > /dev/null 2>&1 < /dev/null &`
      and wait for `EXIT=0` (about 15 minutes).
   5. `bash scripts/ops/verify-live.sh`: every line should say 200; the Sentry
      "disableLogger" line is normal.
3. Mark the step deployed in `BUILD_CHECKLIST.md`, update this file, and
   push.
