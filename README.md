# Apartment Masters

Live at **https://apptmasters.com**.

Apartment Masters is one product with two connected phases:
**Find a Home → Create / Join My Home → Live & Manage Together.** People search
listings in the marketplace, then run their shared home in one place:
cleaning and shopping rotations, groceries and inventory, rent and shared
money, maintenance with the landlord, calendar and chat.

The product rule: **workflow-driven, not page-driven.** A user does something
once and every part of the app that's affected updates itself:
*one action → automatic downstream updates → clear next step.*

| Document | What it's for |
|---|---|
| [`docs/PRODUCT_LOGIC.md`](docs/PRODUCT_LOGIC.md) | Product & functional blueprint, the source of truth for how the product behaves |
| [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md) | Phase-by-phase build checklist with owner test steps and sign-offs |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Security & engineering roadmap (what's fixed, what's open) |
| [`tests/README.md`](tests/README.md) | How the automated tests work |

---

## Run it locally

Requires Node.js 20 and PostgreSQL 16.

```bash
npm install
npx prisma db push      # create tables in the database from DATABASE_URL
npm run dev             # http://localhost:3000
```

Create `.env.local` with the keys listed in [`.env.example`](.env.example):
`DATABASE_URL`, `APP_URL`, `JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `RESEND_API_KEY`,
`RESEND_FROM`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
Without the Resend key, emails are skipped. Without the VAPID keys, push
notifications are off. The schema is applied with `prisma db push`; the
`prisma/migrations` folder is out of date (left over from SQLite).

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check of the app and the tests |
| `npm test` | API tests against a real Postgres database whose name contains `test` (see `tests/README.md`) |
| `npm run lint:ratchet` | Lint; fails if the number of errors goes up |

GitHub runs all three plus a production build on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). A red ✗ means: don't deploy.

## Deploy

The site runs on an AWS EC2 server (Ubuntu, 1 GB RAM): pm2 runs `npm start`
on port 3000 behind nginx with Let's Encrypt, in `/var/www/apptmasters`.

1. Run the checks locally, push `master`, and wait for CI to pass.
2. On the server, save the current build for rollback:
   `cp -a .next ~/backups/<date>/next-build-<commit>`.
3. `git pull --ff-only origin master`, then `npm install` if dependencies changed.
4. Build in the background. The server runs out of memory during the build's
   own type check, so it's skipped there (the checks above already ran):
   ```bash
   nohup sh -c "SKIP_BUILD_TYPECHECK=1 npm run build > /tmp/build.log 2>&1; echo EXIT=\$? >> /tmp/build.log" &
   ```
   Wait for `EXIT=0` in `/tmp/build.log` (about 2–15 minutes). The site keeps
   serving the old version meanwhile.
5. `pm2 restart apptmasters`, then check the main pages and
   `~/.pm2/logs/apptmasters-error.log`.

After any database schema change (`npx prisma db push`), check that every table
belongs to the app's database role, or the app gets "permission denied":
```sql
select tablename, tableowner from pg_tables where schemaname = 'public';
```

## Working agreements

- All product work happens in this repository (the live app).
- Work is built **one phase at a time** ([`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md)):
  automatic checks pass → deployed to apptmasters.com → the owner tests with
  the written steps → the owner signs off → the next phase starts.
- Everything is pushed to GitHub at the end of every working day.
- Changes to the server's configuration (nginx, firewall, services) are
  approved by the owner one by one.

---

## Product roadmap

Built from [`docs/PRODUCT_LOGIC.md`](docs/PRODUCT_LOGIC.md) §24. Each sprint
reuses what already exists where it can. Detailed test steps and sign-offs live
in [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md).

**Owner decisions (2026-10-07)**
1. Build in the live app; back up to GitHub at the end of every day.
2. The new Money ledger is built **alongside** the current finance system.
   Both must give the same numbers for every household before switching over.
3. Features that aren't in the blueprint (roommate scores, house-rule voting,
   shared agreements, activity feed, stats/analytics, audit log) move under
   **More**. **Calls move into Chat.**
4. Finish the remaining security work first (Phase S below).

| | Phase | Goal | Builds on |
|---|---|---|---|
| [x] | **S — Security** | Close the remaining items in `docs/ROADMAP.md` Phase 1 | `src/lib/access.ts`, `src/lib/auth.ts` |
| [ ] | **1 — Foundation** | User states (Visitor → Home Seeker → Found a Home → Home Member), roles in context, one design system, bottom navigation **Home \| Household \| Money \| Chat \| More** | `src/lib/access.ts`, `components/landing`, `components/auth` |
| [ ] | **2 — Home** | Priority feed (P1 critical → P5 info): "what needs my attention now?" instead of a feature grid | notifications, rent, rotations, maintenance |
| [ ] | **3 — Cleaning** | Whole-home rotation with Rotation \| Schedule \| History, travel skip, "Can't clean this week?" | `CleaningRotation`, `CleaningLog`, `TravelPeriod` |
| [ ] | **4 — Shopping** | One flow: rotation, optional Home Check, live shared list, shopper alerts, PREPARING → SHOPPING → LEFT_STORE → COMPLETED | `PurchaseRotation`, `GroceryItem`, `InventoryItem` |
| [ ] | **5 — Money engine** | One ledger for rent, groceries, expenses, payments and the fund, **built in parallel and compared** before switch-over | `Expense`, `ExpenseSplit`, `Settlement`, `RentPayment`, `FundTransaction` |
| [ ] | **6 — Shopping → Money** | Completing a trip creates the expense, split, balances and next turn; no manual Add Expense | Sprints 4 + 5 |
| [ ] | **7 — Rent** | Landlord paid vs. roommates reimbursed; outstanding per month; reminders. Rent appears in the shared balance (today it doesn't) | `RentConfig`, `RentCycle`, `RentPayment` |
| [ ] | **8 — Maintenance** | REPORTED → ACKNOWLEDGED → SCHEDULED → IN PROGRESS → COMPLETED → RESOLVED, landlord scheduling, resident confirmation | `MaintenanceRequest`, manager portal |
| [ ] | **9 — Calendar + Notifications** | Calendar built from other modules' events; one notification service with preferences and anti-spam grouping | `CalendarEvent`, `Notification`, push |
| [ ] | **10 — More / Issues / Insights** | Secondary menu (incl. scores, rules, agreements, activity, stats, audit), Disputes → Household Issues, Calls → Chat, insights from the ledger | existing pages |
| [ ] | **11 — Marketplace → My Home** | "Have you found your new home?" follow-up and Create / Join Home flow | listings, invites |

## Security & engineering

Done so far:
- Apartment data restricted to approved members (all 108 apartment API handlers).
- Two-factor sign-in enforced by the server.
- Real account lockouts and rate limits that can't be bypassed.
- Email confirmation for new accounts.
- User text escaped in all emails.
- Same-site-only redirects after sign-in.
- Next.js security update.
- Automated tests and CI.

Open items and the full history are in [`docs/ROADMAP.md`](docs/ROADMAP.md).
