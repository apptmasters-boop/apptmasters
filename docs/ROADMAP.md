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

Fixed on branch `fix/phase1-apartment-access` (2026-10-03), each covered by tests:

- [x] **HIGH: apartment data readable by non-members.** 40 of 108 handlers
      under `src/app/api/apartments/[id]/` only checked sign-in. All 108 now
      call `requireApartmentMember` / `requireApartmentAdmin`
      (`src/lib/access.ts`). Item routes also verify the item belongs to the
      apartment in the URL. Test: `tests/apartment-access.test.ts`.
- [x] **HIGH: members with a pending join request had access.** 55 handlers
      let PENDING_APPROVAL members through, which made the admin-approval
      step meaningless. Fixed by the same helper.
- [x] **CRITICAL: two-factor sign-in was only enforced by the login page.**
      `/api/auth/login` returned a full token after the password even for 2FA
      accounts. Now it returns a short-lived challenge and emails the code;
      `/api/auth/2fa/verify` needs challenge + code. See `src/lib/twoFactor.ts`.
- [x] **HIGH: lockouts did not stop brute force** (login and 2FA codes): the
      lock was only checked after a wrong guess. Now checked first (`isLocked`).
- [x] **MEDIUM: per-IP rate limits were bypassable** via a client-supplied
      `X-Forwarded-For`. All six routes now use `clientIp()` (nginx `X-Real-IP`).
- [x] **MEDIUM: JWT secret had a public fallback.** Now throws in production
      if `JWT_SECRET` is missing.
- [x] 2FA codes now come from a cryptographic RNG (`crypto.randomInt`).
- [x] Calendar events: only the creator or an admin may edit (matches delete).
- [x] **Dependencies:** Next.js 16.2.6 → 16.3.8 (critical advisory), Prisma
      7.8 → 7.10, `npm audit fix`. 1 critical / 11 high / 5 moderate → 4 high.
- [ ] Remaining 4 high advisories are inside Prisma's CLI tooling
      (`deepmerge-ts`, `mysql2` via `@prisma/dev`); npm's only offer is a
      breaking downgrade to Prisma 6. Re-check on the next Prisma release.
- [x] `next build` no longer crashes when email is not configured (Resend
      client is created lazily), so CI can build.

Fixed 2026-10-04 (branch `feat/signup-email-verification`):

- [x] **Public sign-up created usable accounts without confirming the email.**
      Accounts now stay unusable until the emailed link is clicked
      (`src/lib/emailVerification.ts`). An unconfirmed sign-up made with
      someone else's address can be taken over by the real owner.
- [x] **HIGH: HTML injection in emails.** Names, apartment names and
      notification text went into email HTML raw, so a sign-up with a
      victim's address and a crafted "name" became phishing from our domain.
      All templates now use `esc()` (`src/lib/email.ts`).
- [x] **HIGH: maintenance "escalate" was an open mail relay.** Any member
      could email any address with arbitrary HTML from our domain. Body is
      now escaped and capped, address validated, 5 emails/hour per user.
- [x] **MEDIUM: open redirect via `returnTo`** on sign-in, sign-up and the
      confirmation link. `safeReturnTo()` (`src/lib/returnTo.ts`) only
      allows same-site paths.
- [x] **Production DB: the `EmailVerificationToken` table was owned by
      `postgres`,** not the app's `apptmasters` role (the only one of 57
      tables), so every email-confirmation read/write failed with
      "permission denied". Email confirmation had never worked live. Fixed
      2026-10-04 with `ALTER TABLE "EmailVerificationToken" OWNER TO apptmasters`.
      If tables are ever created as `postgres` again, check ownership:
      `select tablename, tableowner from pg_tables where schemaname = 'public'`.

Still to do in Phase 1:

- [ ] Unconfirmed sign-ups are never cleaned up; delete ones older than a
      few days (cron).

- [ ] Real-time streams (`chat/stream`, `dm/[userId]/stream`) take the login
      token in the URL, so it lands in nginx access logs. Use a short-lived
      stream ticket instead.
- [ ] 2FA page only accepts 6 digits, so backup codes (`XXXX-XXXX`) cannot
      be entered.
- [ ] Routes outside `/api/apartments` (listings, manager, admin, users,
      upload, push, cron, invites) still to review.
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

- [x] One apartment permission helper (`src/lib/access.ts`) used by all 108
      apartment handlers; the three copies of `canManage` in manager routes
      became `canManageApartment`. (Done early as part of the Phase 1 fix.)
- [ ] Remove the `const payload = { userId: access.userId, ... }` shims the
      migration left in some handlers; use `access.userId` directly.
- [ ] `requireUser` for the remaining signed-in-only routes, and fold
      `requireManager` / `requireSuperAdmin` into the same style.
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

## Decisions

- **2026-10-07 (owner):**
  1. All product work is built in this repository (the live app), not the
     `develop` monorepo, and pushed to GitHub at the end of each day.
  2. The Money ledger is built alongside the current finance code and compared
     before switching over.
  3. Features outside the blueprint move under More; calls move into Chat.
  4. The remaining Phase 1 items here are delivered as **Phase S** in
     `docs/BUILD_CHECKLIST.md`, with owner testing on apptmasters.com.

## Open decisions

- Server size: the 1 GB instance swaps heavily during builds (~15 min);
  2 GB would cut deploys to a few minutes.
