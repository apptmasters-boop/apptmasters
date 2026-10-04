# ApptMasters engineering roadmap

Goal: a codebase that is **secure**, **clean** (no copy-pasted logic), and
**explains itself** to whoever reads it next, including us, months from now.

Agreed with the owner on 2026-10-03. Scope: this repo (the app running on
apptmasters.com). The `develop` monorepo is a separate product line; decide its
future before investing in Phase 3 here (see "Open decisions").

**How we work.** Every phase lands on its own branch, passes CI, is tested
locally, and is reviewed by the owner before it is deployed. Nothing reaches
the live server without approval.

---

## Phase 0: Safety net

- [x] Test suite (Vitest) that calls the real API route handlers against a
      throwaway Postgres database. See `tests/README.md`.
- [x] First tests: login and lockout, `/api/auth/me`, listings visibility and
      creation, apartment access control.
- [x] CI on GitHub (`.github/workflows/ci.yml`): type check, lint, tests and a
      production build on every push and pull request.
- [x] Lint "ratchet" (`scripts/lint-ratchet.mjs`): CI fails if lint errors go
      up from the baseline (75 on 2026-10-03), so the count can only fall.
- [ ] Moved to **Before public launch**: automated database and upload backups.

## Phase 1: Security review and fixes

Findings so far (found while building Phase 0). Each has a test marked
`it.fails` that flips to a normal test when fixed:

- [ ] **HIGH: apartment data readable by non-members.** At least 20 routes
      under `src/app/api/apartments/[id]/` check that the caller is signed in
      but not that they belong to that apartment (chat, grocery, inventory,
      calendar, feed, fund, notifications, expenses, rent payments, ...).
      Test: `tests/apartment-access.test.ts`.
- [ ] **HIGH: account lockout does not stop brute force.** After 5 failed
      logins the lock only applies to wrong passwords; a correct guess still
      logs in. Test: `tests/auth.test.ts`.
- [ ] **MEDIUM: login IP rate limit is bypassable.** It keys on the raw
      `x-forwarded-for` header, which the client controls. Use nginx's
      `X-Real-IP` (set from the real connection) instead.
- [ ] **MEDIUM: JWT secret has a hard-coded fallback** (`src/lib/auth.ts`).
      If `JWT_SECRET` were ever missing, tokens would be signed with a public
      string. Fail at startup instead.
- [ ] **Dependencies:** `npm audit` reports 1 critical, 11 high and 5 moderate
      issues. Update and re-test.
- [ ] Review every one of the 136 API routes: who may call it, what it checks.
      Produce a table in `docs/SECURITY.md`.
- [ ] File uploads: type, size and naming checks; where files are stored.
- [ ] Auth: token lifetime and storage (currently `localStorage`, 7 days),
      password reset, 2FA, email verification flows.
- [ ] Admin and manager routes: role checks on every one.
- [ ] Server: security group rules, whether MySQL and coturn need to run,
      unattended security upgrades, nginx security headers, SSH keys.
- [ ] Secrets: none in code or git history.
- [ ] 5 `react-hooks/rules-of-hooks` lint errors: hooks called conditionally
      can cause real runtime bugs. Review and fix.

## Phase 2: Shared foundations (remove repeated logic)

- [ ] One permission helper used by every route: `requireUser`,
      `requireApartmentMember(apartmentId)`, `requireApartmentAdmin`,
      `requireManager`, `requireSuperAdmin`. Fixes the Phase 1 access bugs at
      the root.
- [ ] One place for shared labels and formatting (listing types, prices,
      dates), shared icons and shared input validation.
- [ ] Purely visual repetition stays where it is: merging look-alike markup
      often makes pages harder to change.

## Phase 3: Code that explains itself

- [ ] Consistent naming and folder layout.
- [ ] Comments explain *why*, not *what*. A short header in each module saying
      what it is for. Documentation on shared helpers saying what they guarantee.
- [ ] `README.md` (run, build, deploy), `docs/ARCHITECTURE.md`,
      `docs/SECURITY.md`, and a short decision log (`docs/decisions/`).
- [ ] Bring the lint baseline to 0, then make CI run plain `eslint`.

## Phase 4: Keep it that way

- [ ] Dependabot: weekly security update pull requests.
- [ ] Pull request checklist: permissions checked, input validated, test
      added, code explains itself.
- [ ] Short security re-review every few months and before public launch.

## Before public launch (required)

- [ ] Nightly backups of the database and uploads to a private, encrypted S3
      bucket with 30-day expiry, plus a 3-day local copy and a tested restore.
      (~$0.03/month.)
- [ ] AWS Budgets alert emailing the owner above a set monthly amount.
- [ ] Owner stores the server's `.env.local` values in a password manager.
- [ ] All Phase 1 items closed.

## Open decisions

- Long-term relationship between this app and the `develop` monorepo.
- Server size: the 1 GB instance swaps heavily during builds (~15 min);
  2 GB would cut deploys to a few minutes.
