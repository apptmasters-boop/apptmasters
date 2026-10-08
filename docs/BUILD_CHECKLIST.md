# Build checklist

This file tracks what is being built, phase by phase, and records the owner's
approval of each phase. The product spec is [`PRODUCT_LOGIC.md`](PRODUCT_LOGIC.md);
the order comes from the roadmap in the [README](../README.md).

## How we work

1. **One phase at a time.** The developer builds the phase and runs the
   automatic checks: type check, tests, lint, and CI green on GitHub.
2. **The phase goes live for testing.** Once the checks pass, it is deployed to
   **apptmasters.com** and its status becomes **Ready for your test**. The
   previous version is kept on the server, so it can be restored in seconds.
3. **The owner tests** by following the numbered steps. Each step says what to
   do and what should happen.
4. **Sign-off.** The owner either approves or lists what's wrong. Problems are
   fixed inside the same phase and tested again. **The next phase starts only
   after approval.**
5. **Big sprints are split into small slices** (4a, 4b, …), each with its own
   test and sign-off, so no test session is long.
6. Everything is pushed to GitHub at the end of each working day, including
   this file, so it stays a record of what was built and approved.

**Status values:** Not started · Building · Ready for your test · Changes requested · Approved

---

## Gate 0 — Plan and documents

**Status:** Approved

**What was built**
- `README.md`: project overview, how to run, test and deploy, the product
  roadmap, and your four decisions.
- `docs/PRODUCT_LOGIC.md`: your blueprint, word for word.
- This checklist.

**Your check**
1. Open https://github.com/apptmasters-boop/apptmasters. The front page shows
   the new README with the product roadmap table.
2. Open `docs/PRODUCT_LOGIC.md`. It matches the blueprint you sent.
3. Read Phase S and Sprint 1 below. Is anything missing or wrong?

**Sign-off:** [x] Approved on 2026-10-08

---

## Phase S — Security (remaining items)

**Status:** Approved (S1–S7, 2026-10-08) · S8 awaiting per-change approval

**What I'm building**
- **S1. Live chat without the login token in the web address.** Today the live
  chat, direct messages and listing conversations put the login token in the
  URL, where it ends up in server logs. They will use a one-minute "ticket"
  instead.
- **S2. Backup codes on the two-factor screen.** The code box only accepts 6
  digits today, so backup codes (`XXXX-XXXX`) can't be typed.
- **S3. Cleanup of unconfirmed sign-ups.** Accounts never confirmed by email
  are deleted after 7 days (only if they have no apartment and no listings).
  The nightly job is switched on only with your OK.
- **S4. Permission review of the routes outside apartments** (admin, manager,
  listings, uploads, invites, account settings), written up in
  `docs/SECURITY.md`. Any gap found is fixed and tested.
- **S5. Uploads check the real file content**, not just the name the browser
  sends.
- **S6. Scan of the code history for leaked passwords or keys** (report only;
  anything found is changed with your OK).
- **S7. Fix 5 code errors that can cause random page bugs** ("hooks"
  called conditionally).
- **S8. Server hardening** (separate approval for each change): security
  headers in nginx, automatic security updates, firewall review, and whether
  MySQL and the TURN server need to run.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 93 (was 70). New: stream ticket, backup-code sign-in, cleanup job, upload content check, manager/listing-message permissions
- [x] Lint ratchet passes; errors 75 → 70
- [x] CI green on GitHub (commit 2901e4b)
- [x] Deployed to apptmasters.com 2026-10-08; live pages load; no new server errors

**What was found along the way**
- **High:** a property manager could delete almost any account on the platform,
  including admins. Fixed: only their own former tenants who have moved out.
- **Bug:** the 5 code errors (S7) were one real crash. If a voice message
  expired while the chat was open, the chat page broke. Fixed.
- **Clean:** no passwords or keys anywhere in the code history (S6).
- **Waiting for your OK:** the nightly cleanup job (S3) is built and tested,
  but not switched on in the server's schedule yet.

**Your test on apptmasters.com**
1. **Group chat is still live.** Open your apartment's chat on your phone and on
   your computer (same account is fine). Send a message from one.
   → It appears on the other within a few seconds, without refreshing.
2. **Direct messages are still live.** Open a direct message with a roommate on
   two devices and send a message. → It appears on the other device by itself.
3. **Listing conversations are still live.** Open a conversation about a
   listing and send a message. → It appears for the other person without
   refreshing.
4. **Backup code sign-in** (only if you use two-factor sign-in). Sign out, sign
   in with your password, and on the code screen type one of your backup codes
   (format `XXXX-XXXX`). → You are signed in. That backup code no longer works
   a second time.
5. **Photo uploads still work.** Change your profile photo with a normal
   JPG or PNG. → It uploads and shows.
6. **Fake images are refused.** Rename a text file (e.g. `notes.txt`) to
   `notes.jpg` and try to upload it as your profile photo. → It is refused with
   an error message.
7. **Everything else is unchanged.** Sign in, open your apartment, look at the
   chores, grocery and finance pages. → Everything works as before.

**Sign-off:** [x] Approved on 2026-10-08 (S1–S7)
**S8 server changes** (decided 2026-10-08):
- [x] Approved: schedule the nightly cleanup of unconfirmed sign-ups (03:00). Done; first run OK.
- [x] Approved: install 11 pending security updates and reboot. Done; site down 46 s, all services came back by themselves.
- [ ] Declined for now: security headers in nginx.
- [ ] Declined for now: hide the "Next.js" header.
- [ ] Open question: SSH key "claude-code-apptmasters". Not the key used for deploys, so removing it would not lock anyone out. Waiting for the owner's decision.
- No change needed: firewall (only SSH/web reachable), SSH passwords already off, MySQL local-only, TURN server needed for calls.

---

## Sprint 1 — Foundation

**Status:** 1a approved · 1b ready for your test · Spec: `PRODUCT_LOGIC.md` §2, §5, §17, §23

Split into two slices, each with its own sign-off.

### 1a — Navigation and design system

**Status:** Approved

**What was built**
- **Five main destinations,** in a bottom bar on phones and a side menu on
  computers, in the green design: **Home · Household · Money · Chat · More**.
- **Chat badge:** unread group messages plus unread direct messages, shown on
  the Chat tab. It updates when you move between pages and every 30 seconds.
- **No back arrow on the five main pages.** The other pages have a back link
  to the main page they belong to: Cleaning → "← Household", Rent → "← Money",
  Calendar → "← More". This replaces the old "← Apartment" links on 20 pages.
- **Household page:** Cleaning, Shopping list, Shopping rotation, Inventory,
  Chores, Rooms.
- **Money page:** Shared expenses & balances, Rent, Shared fund.
- **More page:**
  - **Home management:** Maintenance, Household issues, Calendar.
  - **Insights:** Activity, Stats, Analytics.
  - **Household records:** Roommate scores, Shared agreements, Audit log, Search.
  - **Marketplace:** Search listings, My listings.
  - **Account:** Profile & settings, Notifications, and Admin (platform admins only).
  - **Sign out.**
- **Calls:** were already started from inside Chat, so nothing moved.
- **Not changed in this slice:**
  - **Home** keeps today's dashboard. Sprint 2 rebuilds it as the priority feed.
  - **House rules and votes** are still part of that dashboard; they move into
    More when Home is rebuilt.
  - **The pages' own content** keeps its current look; this slice changes the
    navigation and the new menu pages.
- The listings pages show the same navigation when you're a member of a home.
- Removed: the old 16-link sidebar and an unused bottom-bar component.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 108 (+15 new: navigation rules for every page, unread count, members-only)
- [x] Lint: no new errors (70)
- [x] Local production build passes
- [x] CI green on GitHub (ed1f241)
- [x] Deployed to apptmasters.com 2026-10-08; all new pages respond; no new server errors

**Your test on apptmasters.com**
1. On your **phone**, sign in and open your home. → A bar at the bottom shows
   Home, Household, Money, Chat and More. The page you're on is green.
2. Tap **Household**, **Money**, **Chat** and **More**. → Each page has no back
   arrow.
3. In **Household**, tap **Cleaning**. → At the top it says **"← Household"**,
   and tapping that takes you back to Household. Try **Money → Rent**
   ("← Money") and **More → Calendar** ("← More") too.
4. Have a roommate send a message in the group chat (or a direct message to
   you) while you're on **Home**. → Within about 30 seconds, or as soon as you
   change page, the **Chat** tab shows a red number. Open Chat, then go back to
   Home. → The number is gone.
5. Open **More**. → You see the groups above. **Sign out** at the bottom signs
   you out.
6. In **Chat**, the call buttons are in the top-right corner, as before.
7. On a **computer**, the same five appear as a menu on the left, with your
   home's name at the top.
8. Open **More → Search listings**. → The listings show with the same bottom
   bar (phone) or left menu (computer), so you can go back to your home.

**Sign-off:** [x] Approved on 2026-10-08

### 1b — User states and roles in context

**Status:** Ready for your test

**What was built**
- **Where you land after signing in**, one rule for everyone (`src/lib/housing.ts`):
  - **In a home** → Home, whatever your role (a platform admin or property
    manager who lives in a home lands on Home too).
  - **Waiting for a join request to be approved** → "Your homes", where it
    shows as pending.
  - **Property manager without a home** → the manager portal.
  - **Platform admin without a home** → Admin.
  - **Everyone else (home seekers)** → Find a Home (the listings).
- **No platform numbers outside Admin.** The "Your homes" page used to show
  total users, apartments, messages and expenses to platform admins; now it
  only offers a link to Admin. It also lists your homes for every role (before,
  an admin or manager who lived in a home didn't see it there).
- **The Admin link** appears only for platform admins: in More → Account, and
  on "Your homes".
- **Household roles:** creating or deleting the cleaning rotation is now for
  household admins only, on the server and on the page. Regular members don't
  see those buttons and get "Only household admins can do this" if they try.
  Marking your own turn done stays open to everyone. (Rent payer: only the
  designated rent payer can confirm rent payments, as before.)
- **Saved housing state:** each account reports Home Seeker, Found a Home or
  Home Member. "Found a Home" is set by the Sprint 11 follow-up question.
  Database change: one new, empty `foundHomeAt` date on users.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 120 (+12 new: states, landing rule, admin-in-a-home lands on Home, rotation admin-only)
- [x] Lint: no new errors (70)
- [x] CI green on GitHub (e61b1cd)
- [x] Deployed to apptmasters.com 2026-10-08. The new column was added
  directly: the usual `prisma db push` stopped because the live users table has
  an extra old column (`platform_role`) that it wanted to delete. That column was
  left untouched. A signed-in "who am I" request was checked on the live server.

**Your test on apptmasters.com**
1. Sign in with an account that has **no** apartment. → You land on Find a
   Home (the listings), not on an empty dashboard.
2. Sign in with an account that **is** in an apartment. → You land on Home.
3. Sign in with your **super-admin** account. → You land on Home like everyone
   else. More → Account shows "Admin", which opens the admin dashboard.
4. Sign in as a **regular member**. → No admin numbers (total users,
   apartments) appear anywhere, and More has no "Admin" link.
5. As a regular (non-admin) member, try to change a household setting that only
   admins may change, such as editing the cleaning rotation. → The option is
   hidden, or you get a clear "only household admins can do this" message.

**Sign-off:** [ ] Approved on ____  · Issues found: ____

---

## Later sprints (outline; detailed test steps are written when each starts)

| Sprint | Planned slices | Status |
|---|---|---|
| 2 — Home priority feed | 2a feed with P1–P5 items · 2b "what's next" after actions | Not started |
| 3 — Cleaning | 3a Rotation / Schedule / History · 3b travel skip and "Can't clean this week?" | Not started |
| 4 — Shopping | 4a shared list and live shopper alerts · 4b trip states (preparing → at the store → left the store) · 4c optional Home Check from Inventory | Not started |
| 5 — Money engine | 5a ledger built in parallel + comparison report · 5b switch-over once numbers match | Not started |
| 6 — Shopping → Money | 6a finish trip: total, receipt, review split, confirm → expense created | Not started |
| 7 — Rent | 7a landlord paid vs. roommates reimbursed · 7b monthly history and reminders | Not started |
| 8 — Maintenance | 8a new statuses and landlord scheduling · 8b resident "fixed / still a problem" | Not started |
| 9 — Calendar + Notifications | 9a calendar fed by other modules · 9b one notification service with preferences | Not started |
| 10 — More / Issues / Insights | 10a Household Issues (was Disputes) · 10b insights from the ledger | Not started |
| 11 — Marketplace → My Home | 11a "Have you found your new home?" · 11b Create / Join Home flow | Not started |
