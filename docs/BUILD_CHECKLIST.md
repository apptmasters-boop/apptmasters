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

**Status:** Not started · Spec: `PRODUCT_LOGIC.md` §2, §5, §23

Split into two slices, each with its own sign-off.

### 1a — Navigation and design system

**What I'm building**
- A bottom navigation bar for home members on phones, and the same five
  destinations in a side menu on computers:
  **Home · Household · Money · Chat · More**.
- **Chat badge:** the unread-message count shows on the Chat tab.
- **No back arrow on the five main pages.** Pages opened from them (an expense,
  a rotation, a maintenance request…) have a back arrow to where you came from.
- **More menu** grouped as in the blueprint:
  - **Home Management:** Maintenance, Household Issues, Calendar.
  - **Insights:** Activity, Stats.
  - **Marketplace:** Search Listings, My Listings.
  - **Account:** Profile, Notifications, Settings, Help.
  - **The features you asked to keep:** roommate scores, rules & votes, shared
    agreements, audit log.
  - **Calls** move into Chat.
- **The green Apartment Masters design** (as on the landing and sign-in pages)
  applied to the home-member pages' navigation, headers and cards. The pages'
  content stays the same in this slice.

**Your test on apptmasters.com**
1. On your phone, sign in as a home member. → A bar at the bottom shows Home,
   Household, Money, Chat and More, in the green design.
2. Tap each of the five. → Each opens without a back arrow at the top.
3. From Money, open any expense or rent page. → It has a back arrow, and
   tapping it returns to Money.
4. Have a roommate send you a chat message while you're on Home. → The Chat
   tab shows a number. After you open Chat, the number disappears.
5. Open More. → You see the groups listed above, including Scores, Rules,
   Agreements and Audit.
6. Start a call. → It starts from inside Chat (there's no separate Calls page).
7. On a computer, the same five destinations appear in the side menu.

**Sign-off:** [ ] Approved on ____  · Issues found: ____

### 1b — User states and roles in context

**What I'm building**
- **Where you land after signing in depends on your state:**
  - A **Home Seeker** (no household yet) lands on Find a Home.
  - A **Home Member** lands on Home.
- **The platform admin dashboard** opens only from an "Admin" link (in More →
  Account), only for super-admin accounts. A regular member never sees admin
  statistics, even if the same person is also an admin.
- **Household roles** (Member, Household Admin, Rent Payer) control what each
  person can change, using the shared permission checks.
- **A saved "housing state" for each account** (Visitor → Home Seeker → Found
  a Home → Home Member). Sprint 11 uses it.

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
