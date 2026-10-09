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

**Status:** Approved (1a and 1b, 2026-10-08) · Spec: `PRODUCT_LOGIC.md` §2, §5, §17, §23

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

**Status:** Approved

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

**Sign-off:** [x] Approved on 2026-10-08

---

## Sprint 2 — Home priority feed

**Status:** Approved (2a and 2b, 2026-10-09) · Spec: `PRODUCT_LOGIC.md` §6, §16, §23

Home answers one question: *"What needs my attention now?"* It's a short,
ordered list, not a grid of features.

### 2a — The priority feed

**What I'm building**
- **Home shows only what matters now, in priority order**, built on the
  server from data the app already has:

  | Priority | Shown as | Examples |
  |---|---|---|
  | **P1 Critical** | red, at the very top | urgent repairs not yet fixed |
  | **P2 Money** | amber | your rent share due or overdue; money you owe in shared expenses; a roommate's cash payment waiting for your confirmation |
  | **P3 Your turn** | green action cards | your cleaning turn (due soon or late); your turn to buy something; your chores due today or late; expense edits waiting for your vote; (household admins) people asking to join |
  | **P4 Coming up** | a short list | calendar events in the next 7 days |
  | **P5 Recently** | small, low emphasis | the last few household updates |

- **Things that belong to someone else** (their cleaning turn, their chores)
  are not shown to you.
- **Ordinary chat messages are not on Home.** They're on the Chat badge.
- **The household announcement**, if there is one, stays at the top.
- **When nothing needs you:** "You're all caught up".
- **Nothing is lost:** today's Home page moves unchanged to **More → Household
  overview**. Slice 2b gives its parts proper places, then removes it.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 130 (+10 new: priority order, rent due-date rule, urgent repair first and gone once resolved, overdue rent, what I owe, cleaning turn only for its owner, 7-day window, chat never on Home, join requests only for admins, members-only endpoint)
- [x] Lint: no new errors (70)
- [x] "You owe" uses the same calculation as the balance page (moved into `src/lib/balances.ts`, used by both)
- [x] CI green on GitHub (35da6a7)
- [x] Deployed to apptmasters.com 2026-10-09; checked with a real household (feed built correctly, no new errors)

**Your test on apptmasters.com**
1. Open **Home**. You see a short list, not a grid. If nothing needs you, it
   says "You're all caught up".
2. **Urgent repair:** report a maintenance issue with priority **Urgent**
   (More → Maintenance). Go back to Home. It's at the very top, in red. Mark
   it resolved, and it disappears from Home.
3. **Money:** if your rent share for this month isn't marked paid, Home shows
   it with the amount (amber). Add a shared expense that someone else paid and
   that includes you. Home shows "You owe …".
4. **Your turn:** if it's your cleaning turn, Home says so. A roommate whose
   turn it isn't doesn't see it.
5. **Coming up:** add a calendar event for 3 days from now. It shows under
   "Coming up". An event 3 weeks away doesn't.
6. **Chat isn't on Home:** have someone send a chat message. Only the Chat tab
   badge changes; no card appears on Home.
7. Open **More → Household overview**. Everything from the old Home page is
   still there (members, invite code, house rules and votes, join requests).

**Sign-off:** [x] Approved on 2026-10-09

### 2b — A proper place for the rest of the old Home page

**Status:** Approved

**What was built** (the temporary "Household overview" is removed; every part
now has a home):

| Old overview part | New place |
|---|---|
| Invite code, invite link, email invite (admins) | **Household → Members** |
| Member list, "Mark as traveling / back home", "Leave this home" | **Household → Members** |
| House rules: list, propose (48-hour vote), vote, add directly / archive (admins) | **Household → House rules** |
| Announcement; join requests; member roles, status, guest access; remove member; move-out report; audit log link | **More → Home settings** (household admins only) |
| Profile link, roommate scores | already in **More** |
| Statistics tiles | replaced by the Home feed (Sprint 2a) and More → Stats |

- **Home's join-request item** now opens Home settings.
- **One member's page** goes back to "← Members".
- **Three loaders become one:** Members, House rules and Home settings share one
  data loader (`src/components/home/useApartment.ts`).

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 134 (navigation for the new pages; join requests link to settings)
- [x] Lint: errors 70 → 69
- [x] CI green on GitHub (0128f4e)
- [x] Deployed to apptmasters.com 2026-10-09; new pages respond, old overview gone, a real household loads correctly

**Your test on apptmasters.com**
1. **Household** now also lists **Members** and **House rules**.
2. **Members:** you see everyone, with the invite code. "Copy code" and "Copy
   invite link" work. Tap a person, then "← Members" brings you back.
3. **Traveling:** on your own card tap **Mark as traveling**, then confirm. A
   "Traveling" badge appears. Tap **Mark as back home**, and it goes away.
4. **House rules:** as a regular member, propose a rule. It appears under
   "Being voted on" with Yes/No buttons. As a household admin, add a rule
   directly. It appears under "Our rules".
5. **Home settings** (household admin): **More** shows "Home settings". Set an
   announcement, and it appears at the top of everyone's Home. Change a
   member's role or status. If someone asks to join, approve them here, or from
   the item on Home.
6. As a **regular member**, More has **no** "Home settings".
7. **More** no longer shows "Household overview".

**Sign-off:** [x] Approved on 2026-10-09

---

## Sprint 3 — Cleaning

**Status:** Approved (3a and 3b, 2026-10-09) · Spec: `PRODUCT_LOGIC.md` §8, §21

Cleaning is one whole-home rotation: *your turn → mark as cleaned → history
saved → next person's turn scheduled*, all automatically.

### 3a — Rotation, Schedule and History

**What I'm building**
- **Three views on the Cleaning page.**
  - **Rotation:** whose turn it is and when it's due, the order of everyone in
    the rotation, and who's next. "Mark as cleaned" works as today, with an
    optional photo and note.
  - **Schedule:** the next turns with their dates, skipping people who'll be
    traveling on that date.
  - **History:** every past cleaning (who, when, photo, note), newest first.
    Today only the last 3 show.
- **Settings tucked away:** creating and deleting a rotation sit in a small
  settings area that only household admins see, instead of large buttons.
- The green design, like the rest of My Home.
- **The Schedule can't disagree with what actually happens.** "Who's next"
  was copied in three places; it's now one shared rule (`src/lib/rotation.ts`),
  and the Schedule uses it too.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 141 (+7: schedule order and dates, skipping someone away, a finished trip isn't skipped, mark as cleaned saves history and passes the turn, history is per home)
- [x] Lint: errors 69 → 68
- [x] CI green on GitHub (fe6b2c8)
- [x] Deployed to apptmasters.com 2026-10-09; checked with a real household rotation (6-turn schedule, history loads, no new errors)

**Your test on apptmasters.com**
1. Open **Household → Cleaning**. You see three tabs: **Rotation**,
   **Schedule** and **History**.
2. **Rotation** shows whose turn it is, the due date, the order and who's next.
3. **Schedule** lists the next turns with dates. Mark a roommate as traveling
   for next week (Household → Members). Their turn that week is skipped in the
   Schedule.
4. When it's your turn, tap **Mark as cleaned** (add a photo if you like). The
   turn moves to the next person, Home no longer shows your cleaning item, and
   your cleaning is at the top of **History**.
5. As a **regular member**, there's no create or delete option. As a
   **household admin**, they're in the settings area.

**Sign-off:** [x] Approved on 2026-10-09

### 3b — "Can't clean this week?"

**Status:** Approved

**What I'm building** (owner's choice, 2026-10-09: the next person must accept)
- **The request:** the person whose turn it is taps **"Can't clean this
  week?"** and can add a reason. This asks the **next person** to swap.
- **Where the next person sees it:** on their **Home** (under "Your turn") and
  on the Cleaning page, with **Accept** and **Decline**.
- **Accept:** they clean this time, and the requester takes their next turn.
  Nobody gains or loses a turn.
- **Decline:** nothing changes; the turn stays with the requester, who is told.
- **The requester can cancel** while it's still waiting.
- **History** shows swaps ("Sam cleaned for Alex").
- One new database table for swap requests.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 148 (+7: only the current person can ask; the next person is asked and sees it on Home; no double request; accept trades places; decline keeps the turn; only the asker can cancel; answered requests are final; a stale accept is refused)
- [x] Lint: no new errors (68)
- [x] CI green on GitHub (8148766)
- [x] Deployed to apptmasters.com 2026-10-09 (new table created with targeted SQL, owned by the app's database account; checked with a real household)

**Your test on apptmasters.com** (needs two accounts in the same home)
1. On the account **whose turn it is**, tap **Can't clean this week?**, add a
   reason, and send.
2. On the **next person's** account, Home shows "Alex asked you to swap
   cleaning turns". Open it and tap **Accept**. It's now their turn, and the
   first account's next turn comes after.
3. Try again and tap **Decline**. The turn stays with the first person.
4. Send a request and **cancel** it before it's answered. It disappears.

**Sign-off:** [x] Approved on 2026-10-09

---

## Sprint 4 — Shopping

**Status:** 4a building · Spec: `PRODUCT_LOGIC.md` §10.1–10.6

Shopping becomes one flow: whose turn it is, one shared list, and the trip
itself. Paying for the trip (total, receipt, split) comes in Sprint 6, once the
Money ledger exists.

### 4a — Whose turn, one shared list, and the trip steps

**Status:** Building

**What I'm building**
- **One household shopping turn.** Everyone living in the home (not guests),
  in the order they joined; admins can change the order. People who are away
  are skipped, the same way as for cleaning. New members join the end of the
  order automatically.
- **One Shopping page** (Household → Shopping) with the shopper at the top,
  then the shared list. The old Grocery list page opens this page.
- **Trip steps for the shopper:** **Start preparing** → **I'm at the store** →
  **I've left the store** → **Finish trip**. Everyone sees which step the
  shopper is on.
- **Finish trip:** ticked items leave the list (they were bought); unticked
  items stay for next time; the turn passes to the next person.
- **The list updates by itself** every few seconds while the page is open.
- **Home** shows "Your turn to do the shopping" to the shopper.
- **Kept as they are:** the per-item rotations ("toilet paper, monthly") move
  to Household → **Who buys what**. Nothing is deleted.

**Automatic checks (developer)**
- [ ] Type check passes
- [ ] Tests pass (new: who is in the turn, away people skipped, only the
      shopper can move the trip on, steps only go forward, finishing passes the
      turn and clears bought items, admins only for the order)
- [ ] Lint: no new errors
- [ ] CI green on GitHub
- [ ] Deployed to apptmasters.com

**Your test on apptmasters.com** (two accounts in the same home)
1. Household → **Shopping**. The top card says whose turn it is.
2. On both accounts, add a few items. Each one appears on the other screen
   within a few seconds, without refreshing.
3. On the shopper's account, tap **Start preparing**, then **I'm at the
   store**. The other account shows "*Name* is at the store".
4. Tick two items, tap **I've left the store**, then **Finish trip**. The two
   ticked items are gone, the others are still there, and it's now the next
   person's turn.
5. On the next person's account, Home shows "Your turn to do the shopping".

**Sign-off:** [ ] Approved on ____  · Issues found: ____

### 4b — Live alerts for the shopper, and late items

**Status:** Not started (test steps written when it starts)

- While the shopper is at the store, items added by others go to the shopper as
  a notification, grouped ("3 new items: Tomatoes, Milk, Rice"). Others don't
  get it.
- After "I've left the store", adding an item says "*Name* has already left the
  store. This item will be on the next list."

### 4c — Optional Home Check

**Status:** Not started (test steps written when it starts)

- At the start of their turn, the shopper can **Start Home Check** or **Skip
  for now**. Home Check shows Inventory items that are Low or Out, and adds them
  to the list in one tap. Shopping never waits for it.

---

## Later sprints (outline; detailed test steps are written when each starts)

| Sprint | Planned slices | Status |
|---|---|---|
| 5 — Money engine | 5a ledger built in parallel + comparison report · 5b switch-over once numbers match | Not started |
| 6 — Shopping → Money | 6a finish trip: total, receipt, review split, confirm → expense created | Not started |
| 7 — Rent | 7a landlord paid vs. roommates reimbursed · 7b monthly history and reminders | Not started |
| 8 — Maintenance | 8a new statuses and landlord scheduling · 8b resident "fixed / still a problem" | Not started |
| 9 — Calendar + Notifications | 9a calendar fed by other modules · 9b one notification service with preferences | Not started |
| 10 — More / Issues / Insights | 10a Household Issues (was Disputes) · 10b insights from the ledger | Not started |
| 11 — Marketplace → My Home | 11a "Have you found your new home?" · 11b Create / Join Home flow | Not started |
