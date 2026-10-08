# Security model

Who can call which API route, and what each route checks. Reviewed
2026-10-08 (Phase S). Keep this file up to date when adding or changing a route.

## Identity

| Mechanism | Where | Notes |
|---|---|---|
| Login token (JWT, 7 days) | `Authorization: Bearer …`, read by `getTokenFromRequest` (`src/lib/auth.ts`) | Stored by the browser in localStorage ("Remember me") or sessionStorage |
| Two-factor challenge (10 min) | `/api/auth/2fa/*` | Separate signing key; never valid as a login token |
| Stream ticket (60 s) | `?ticket=` on `/stream` routes, from `POST /api/stream-ticket` | Separate signing key; only opens a live stream |
| Cron secret | `x-cron-secret` header on `/api/cron/*` | Must match `CRON_SECRET`; called by the server's crontab |
| One-time email tokens | password reset (1 h), email confirmation (24 h), invites | Random 32 bytes, single use, expiry checked |

## Permission helpers

| Helper | File | Rule |
|---|---|---|
| `requireApartmentMember` / `checkApartmentMember` | `src/lib/access.ts` | Signed in, and has an `ApartmentMember` row for the apartment that is not `PENDING_APPROVAL` |
| `requireApartmentAdmin` | `src/lib/access.ts` | The above, plus role `ADMIN` in that apartment |
| `canManageApartment` | `src/lib/access.ts` | The apartment's assigned manager, or a `SUPER_ADMIN` |
| `requireManager` | `src/lib/auth.ts` | `systemRole` is `MANAGER` or `SUPER_ADMIN` (manager routes then also filter to the manager's own buildings/apartments) |
| `requireSuperAdmin` | `src/lib/auth.ts` | `systemRole` is `SUPER_ADMIN` |

## Routes

### `/api/apartments/[id]/**` (108 handlers)
Every handler calls `requireApartmentMember` or `requireApartmentAdmin`. Routes
for a single item (expense, grocery item, event, …) also check the item belongs
to the apartment in the URL. Tested in `tests/apartment-access.test.ts`.

### Public (no sign-in)

| Route | Protection |
|---|---|
| `GET /api/listings`, `GET /api/listings/[id]` | Only `APPROVED` listings (owner/admin can see their own non-approved one) |
| `POST /api/auth/login` | Per-IP rate limit (real IP via `clientIp`), per-account lockout checked before the password |
| `POST /api/auth/2fa/send`, `/verify` | Need a valid challenge; lockout before verifying |
| `POST /api/listings/signup` | Rate limits per IP and per email; account unusable until email confirmed |
| `POST /api/auth/register` | Closed (503) |
| `POST /api/auth/forgot-password`, `/resend-verification` | Rate limited; same response whether or not the email exists |
| `POST /api/auth/reset-password`, `/verify-email` | Random single-use token with expiry |
| `GET/POST /api/invite/[token]`, `/api/landlord-invite/[token]` | Random token, single use, expiry; refuses emails that already have an account |

### Signed-in user

| Route | Rule |
|---|---|
| `/api/auth/me`, `/api/users/*` (profile, photo, password, 2FA, backup codes, notification prefs, login events) | Only the caller's own account |
| `/api/push/subscribe` | Own subscriptions only |
| `/api/stream-ticket` | Issues a ticket for the caller only |
| `POST /api/listings` | Created as `PENDING`; owner and status can't be set by the client |
| `PATCH/DELETE /api/listings/[id]` | Owner only (admin moderation is under `/api/admin`) |
| `GET/POST /api/listings/[id]/messages` (+ `/stream`) | Only the caller's own conversation. Owners can only reply to people who wrote first; new threads only on approved listings; 4,000-character limit |
| `POST /api/listings/[id]/report` | Any signed-in user |
| `/api/listings/mine`, `/api/listings/inbox` | Caller's own data |
| `/api/upload/*`, `/api/users/upload-photo` | Signed in; size limit; type check (content check: S5) |

### Manager (`/api/manager/**`)
`requireManager`, then every query is limited to buildings, units and
apartments whose `managerId` is the caller (`getOwnedBuilding`,
`canManageApartment`, or an explicit `managerId` filter).
`DELETE /api/manager/users/[id]` only deletes a plain user who was a tenant
in one of the caller's apartments and no longer lives anywhere (fixed in
Phase S: before, it could delete almost any account). Tested in
`tests/routes-outside-apartments.test.ts`.

### Platform admin (`/api/admin/**`)
Every handler calls `requireSuperAdmin`.

### Scheduled jobs (`/api/cron/**`)
`x-cron-secret` must equal `CRON_SECRET`; refused if `CRON_SECRET` is not set.

## Known open items

- **Changing or resetting a password doesn't sign out other devices.** Login
  tokens stay valid until they expire (7 days). Fix: a per-user token version,
  checked on every request. Needs a schema change.
- Login tokens live in browser storage, so any script injected into the page
  could read them. Moving them to an HttpOnly cookie is a larger change; the
  mitigation for now is avoiding script injection (React escaping, email
  escaping, CSP headers in S8).
