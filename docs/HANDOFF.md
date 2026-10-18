# Where we continue

**Updated 2026-10-17.** Read this first, on any PC. Notes that
Claude Code keeps on one PC don't move to another PC; this file does.

**On a new PC, tell Claude Code:** "Read `docs/HANDOFF.md` and continue
from there."

## Right now

**Done on 2026-10-16:** Sprint 13 (all 8 steps approved), fix F1 (filters on
the top row everywhere, prices, every filter tested; approved), pre-launch P2
(AWS budget alert at $15 a month; approved).

**Where we continue (in this order):**
1. **P1 — Nightly backups:** the first automatic run (2026-10-17) didn't happen:
   none of the scheduled jobs could run, their log file was missing
   (`BACKUPS.md`). Fixed on 2026-10-17 with the owner's OK; the rent
   reminders, cleaning penalties and cleanups now run too. Check that the
   automatic run worked: on
   the server `tail -n 3 ~/backups/nightly/backup.log` shows `OK 2026-10-18 …
   github=yes` (also the "last backup" line of `scripts/ops/verify-live.sh`),
   and the private repository `apptmasters-boop/apptmasters-backups` has a
   `2026-10-18` folder. Then the owner replies **"P1 approved"**. Everything
   about backups: [`BACKUPS.md`](BACKUPS.md). (Owner's choice: GitHub,
   encrypted, no S3, no extra fees.)
2. **P3 — Settings in a password manager:** with the owner. They keep
   `appmasters.pem` and use **Google Password Manager** (protected by the
   Google sign-in key on their phone). Steps in
   [`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md), "P3": they copy the backup
   password and the settings file with `ssh … | Set-Clipboard` in a separate
   PowerShell window. **Never show those values in the chat.** Wait for
   **"P3 approved"**.
3. **P4 — A password change signs out other devices:** plan and test steps in
   the checklist first; it needs a small database change (a per-user token
   version), so **ask the owner's OK before applying the SQL on the live site**.
4. **P5 — Security review** before launch.

**The owner's front-end fixes F2–F13 (2026-10-17): LIVE.** The owner tested
them on this PC and said "deploy". Deployed 2026-10-17 (8fc6ba6): build OK,
`verify-live.sh` all 200, live filters check and Home search check passed.
Waiting for the owner's sign-off on apptmasters.com. The owner's rule for
future fixes: "don't deploy it in the server when you finish, I will test it
locally then will ask you deploy when done." Details and test steps: "Fixes
asked by the owner" in [`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md).

| Fix | What |
|---|---|
| F2 | A bare top bar: the logo and Log in / Sign up, or the logo and your name (everything in its menu) |
| F3 | No "Anywhere" button on the results |
| F4 | Enter searches in Filters → Location (ZIP codes too) |
| F5 | "What matters to you?" moves into Filters; the listings come up |
| F6 | The Home search box says "Location", "Enter a city, neighborhood or ZIP code" |
| F7, F10 | The signed-out Home search is one Location box; every filter is on the results |
| F8 | The Price button opens the price range (slider + Min / Max) |
| F9 | One brand name everywhere: ApptMasters |
| F11 | No "More Than Just a Place" section (we don't offer it) |
| F12 | The footer keeps only Help; the local "N" button is hidden |
| F13 | My Profile and Settings (Personal information, Notifications, Login & security, Dark mode) each have their own page |
| F14 | No Messages row on More for people without a Home (the phone bar has it). **Live 2026-10-18 (55fd4ec)** |
| F15 | Money: the "What's next" box shows only when something is waiting (no "Nothing waiting for you"). **Built and pushed, NOT deployed yet: the owner tests on this PC first** (third local login: `roommate@apptmasters.local`, Jordan Roommate in Maple House) |

- **Local copy to test:** http://localhost:3100. Start the test database and
  the app as in [`tests/README.md`](../tests/README.md) and
  `scripts/dev/screenshots/README.md`. Local logins (test data only, never on
  the live site): `owner@apptmasters.local` / `LocalTest-2026` (no Home), and
  `resident@apptmasters.local` / `LocalTest-2026` (lives in "Maple House").
  Seeds: `scripts/dev/screenshots/seed-owner-login.mjs` and
  `seed-resident-login.mjs`.
- **Deploying the next fixes:** same recipe. On the server: pull, `rm -rf
  .next/cache/turbopack`, build, `bash scripts/ops/verify-live.sh`. Then run
  `SHOTS_BASE=https://apptmasters.com node
  scripts/dev/screenshots/filters-ui-check.mjs` (and `f7-check.mjs`; both run
  signed out and change nothing).
- **P4 is on hold** until the owner's front-end fixes are done.

The owner may also send more fixes at any time; they go under "Fixes asked by
the owner" in the checklist, one at a time, each tested and approved.

- **Local test database:** if tests time out on this PC but pass on GitHub,
  recreate it ([`tests/README.md`](../tests/README.md); done on 2026-10-16 at
  about 4,500 test households).
- **How every step runs:** plan and test steps in the checklist first, build,
  compare screens with [`mockups/`](mockups/) when it's a screen, run the
  checks, deploy, and the owner tests and approves before the next step.

## Sprint 13 steps

| Step | What | Status |
|---|---|---|
| 13a | The look everywhere: font, green phone bar, phone logo bar on Home only, full-width desktop header | Approved 2026-10-16 |
| 13b | Home: headline, search, quick pickers (Price, Bedrooms, Move-in date), "Already have a place?", listing tiles | Approved 2026-10-16 |
| 13c | Search results: phone title bar, chip row, All/Apartments/Rooms/Houses tabs, cards as in the picture; desktop cards with the advertiser's photo; move the "Have you found your new home?" card to Home only | Approved 2026-10-16 |
| 13d | Filters as in the picture + 4 new listing details (air conditioning, heat included, dishwasher, square feet). **Needs a database change: ask the owner's OK before applying it on the live site** | Approved 2026-10-16 (database change applied) |
| 13e | Listing page | Approved 2026-10-16 |
| 13f | Saved | Approved 2026-10-16 |
| 13g | Messages (photos, conversation without the phone bar, desktop three panels) | Approved 2026-10-16 |
| 13h | More, How It Works, Help, Create / Join a Home | Approved 2026-10-16 |

Owner decisions: the new look on the **whole app**; **profile photos** shown
when a person added one; the **4 new details** added. Left out because the
app doesn't have them: ratings, "verified" badges (other than "Email
confirmed"), online status, calls, "Schedule viewing", photos and voice in
marketplace messages, folders, saved searches, nearby places.

## Waiting for the owner

- **Tests / sign-offs:** 11a ("Have you found your new home?"), 11b (Create /
  Join a Home), 12a–12e (Find a Home), P1, P3. Approved: Sprints 1–10, all of
  Sprint 13, fix F1, P2.
- **Daily "Have you found your new home?" email:** needs the owner's OK to add
  the server's daily job (`0 14 * * *`, 10 am New York, calling
  `/api/cron/home-search`). It's a server configuration change, so ask first.
- **12f** (map and radius search, Search history, the notification bell for
  people without a home): on hold at the owner's request (2026-10-16).
- **After the owner's 11a test:** put test accounts A and B's real sign-up
  dates back. On the server, run the file
  `~/backups/2026-10-16/restore-test-signup-dates.sql` with
  `sudo -u postgres psql -d <database> -f <file>`.
- **The 3 live listings** don't say how many people can live there yet;
  their owners should edit them (a "People" search skips them until then).
- **Open questions:** keep or remove the SSH key named
  `claude-code-apptmasters` on the server; the friend's GitHub username (to
  invite them); the friend's own SSH key instead of sharing `appmasters.pem`;
  the server size (1 GB, it swaps during builds); the two move-in dates (the
  one on your profile, and the one each Home keeps for rent since Sprint 11b,
  noticed during F13): keep both, or show the Home's one on the profile?
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
