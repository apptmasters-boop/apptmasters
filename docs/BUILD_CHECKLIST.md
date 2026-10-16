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

**Status:** Approved (4a and 4b, 2026-10-10) · Spec: `PRODUCT_LOGIC.md` §10.1–10.6

Shopping becomes one flow: whose turn it is, one shared list, and the trip
itself. The total and receipt are saved on each trip now; splitting them into
everyone's balances comes in Sprint 6, once the Money ledger exists.

### 4a — Whose turn, one shared list, and the trip card by card

**Status:** Approved

**Owner feedback on round 1 (2026-10-09):** show one card after another:
start preparing → do the inventory → at the store → tick the items into the
cart, enter the total, upload the receipt, validate → I've left the store.
Decisions: "I've left the store" ends the trip; the total and receipt are
saved on the trip (the split comes with the Money ledger, Sprints 5–6); the
inventory step can be skipped. (This brings 4c, the Home Check, into 4a.)

**What I'm building**
- **One household shopping turn.** Everyone living in the home (not guests),
  in the order they joined; admins can change the order. People who are away
  are skipped, as for cleaning. New members join the end of the order.
- **One Shopping page** (Household → Shopping). The old Grocery list page
  opens it.
- **The shopper sees one card at a time** (step 1 of 5 … 5 of 5):
  1. **Start preparing.**
  2. **Do the inventory:** items that are Low or Out at home, each with
     **Add** to put it on the list (never twice). **Done with the inventory**,
     or **Skip for now**.
  3. **I'm at the store.**
  4. **The list:** tick each item into the cart. Then **Checkout**: total paid,
     photo of the receipt (or "I don't have the receipt"), **Review and
     validate**, **Validate**.
  5. **Paid $…:** **I've left the store** ends the trip. Ticked items leave the
     list, unticked ones stay for next time, and it's the next person's turn
     (they get a notification). The total can still be corrected before
     leaving.
- **Everyone else** sees which step the shopper is on, and can add items; the
  page refreshes itself every few seconds.
- **Home** shows the shopper their turn once something is on the list, and
  "Your shopping trip is under way" during a trip.
- **Kept as they are:** the per-item rotations ("toilet paper, monthly") are
  under Household → **Who buys what**. Nothing is deleted.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 161 (+13: who is in the turn, away people skipped, only the
      shopper moves the trip on, one card at a time, the inventory can be
      skipped, checkout needs a total and a receipt, the total can be
      corrected, leaving the store clears bought items and passes the turn,
      no duplicate items, receipts must be real images, Home item, admins
      only for the order)
- [x] Lint: no new errors (65)
- [x] CI green on GitHub (4718605)
- [x] Deployed to apptmasters.com 2026-10-09 (4 new trip columns added with
      targeted SQL; checked with a real household)

**Your test on apptmasters.com** (two accounts in the same home; put one or
two items in Household → Inventory with a low quantity first)
1. Household → **Shopping**. On the shopper's account the card says "Step 1
   of 5 · It's your turn to shop". Tap **Start preparing**.
2. **Do the inventory:** the low items are listed. Tap **Add** on one; it says
   "On the list ✓". Tap **Done with the inventory**. (Next time, try **Skip
   for now**.)
3. Tap **I'm at the store**. The other account shows "*Name* is at the store".
   Add an item from the other account; it appears in the shopper's list within
   a few seconds.
4. Tick some items. Enter the total, take a photo of a receipt, tap **Review
   and validate**, check the summary, then **Validate**.
5. The card says "Paid $…". Tap **I've left the store**. The ticked items are
   gone, the others are still on the list, and it's the next person's turn.

**Sign-off:** [x] Approved on 2026-10-10 (after round 2)

### 4b — Alerts for the shopper, and late items

**Status:** Approved

**What I'm building** (PRODUCT_LOGIC §10.4, §10.6)
- **While the shopper is at the store,** items added by others reach the
  shopper as **one** notification that keeps growing: "3 new items on your
  list: Tomatoes, Milk, Rice". Their phone buzzes at most every 2 minutes, not
  for every item.
- **Nobody else gets an alert** for list changes. (Today every addition
  notifies the whole household; that stops.)
- **New items stand out** on the shopper's list with a "New" badge.
- **Whoever adds an item while the shopper is at the store** sees "*Name* is at
  the store and will get it on their list".
- **Once the shopper has paid,** adding an item says "*Name* has already paid.
  This item will be on the next list." It never joins the trip that's ending.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 165 (+4: only the shopper is alerted, only while at the store,
      not for their own items; quick additions grouped into one notification;
      the household isn't notified; late items are flagged and stay for next
      time)
- [x] Lint: no new errors (65)
- [x] CI green on GitHub (0aa174e)
- [x] Deployed to apptmasters.com 2026-10-10 (no database change; checked
      with a real household)

**Your test on apptmasters.com** (two accounts in the same home)
1. On the shopper's account, go through the trip to **I'm at the store**.
2. On the other account, add three items quickly. It says "*Name* is at the
   store and will get it on their list".
3. On the shopper's account: one notification, "3 new items on your list:
   …", and the three items show **New** on the list.
4. On the shopper's account, enter the total and receipt and **Validate**
   (don't leave the store yet).
5. On the other account, add one more item. It says "*Name* has already paid.
   This item will be on the next list."
6. On the shopper's account, tap **I've left the store**. That late item is
   still on the list for next time.

**Sign-off:** [x] Approved on 2026-10-10

### 4c — Home Check

**Status:** Moved into 4a (owner's flow, 2026-10-09)

---

## Sprint 5 — Money engine

**Status:** Approved (5a, 5b, 5c; 2026-10-15) · Spec: `PRODUCT_LOGIC.md` §11, §12, §13, §22

One ledger for everything that's owed: shared expenses, rent, payments and the
shared fund. Owner's rule (2026-10-07): it is built **alongside** today's Money
page, and both must give the same numbers for every household before
anything switches over.

### 5a — The ledger and the comparison report

**Status:** Approved

**What I'm building** (residents see no change yet)
- **One calculation for all money** (`src/lib/ledger.ts`). It turns every
  source into the same kind of entry:
  - a share of an expense: *Sam owes Alex $20 for Groceries*;
  - a share of the month's rent: *Sam owes the rent payer $650 for October*;
  - a payment: *Sam paid Alex $20*. A payment that is waiting for the
    receiver's confirmation is listed, but doesn't count until it's confirmed;
  - an expense marked "settled" by hand counts as paid;
  - money put into or taken out of the shared fund (it changes the fund's
    balance, not what people owe each other).
- **Balances** come from adding up those entries: rent + expenses −
  payments = what each person owes or is owed.
- **The comparison report**, in the site admin area (Admin → **Money
  check**). For every household it shows:
  - ✓ when the ledger gives exactly the same shared-expense balances as
    today's Money page, or ✗ with the differences, person by person;
  - the rent each person still owes, which today's Money page leaves out.
    This is expected to be new; it is what the blueprint asks for (§12.2).

**Decisions I made (tell me if you disagree)**
- Rent marked "paid" by a roommate counts as paid only once the rent payer
  confirms it, the same rule as cash payments for expenses.
- The shared fund is shown as its own balance, not as debts between people.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 177 (+12: expense shares, payments, waiting cash payments,
      expenses marked settled, rent shares and confirmations, fund, the ledger
      matches today's numbers, the report is for site admins only)
- [x] Lint: no new errors (65)
- [x] CI green on GitHub (498743f)
- [x] Deployed to apptmasters.com 2026-10-10 (no database change). First
      live run of the Money check: 2 of 2 households match, no rent owed,
      shared funds consistent

**Your test on apptmasters.com** (signed in with the site admin account)
1. Open **Admin → Money check**.
2. Every household shows ✓ for shared expenses. If one shows ✗, tell me its
   name; the lines underneath show the difference.
3. Look at **Rent still owed** for a household you know. The amounts should
   match what people really still owe their rent payer. If some months were
   paid long ago but never confirmed in the app, they will show here. That's
   the data to clean up before we switch over.

**Sign-off:** [x] Approved on 2026-10-10 (both rules above accepted)

### 5b — The new Money page

**Status:** Approved

**What I'm building** (§11; switch-over approved with 5a: every household
matched)
- **Money tab → Overview | Activity | Balances**, all from the ledger, so rent
  and shared expenses are counted together.
- **Overview:** **You owe** and **You're owed**, with "rent" and "shared
  expenses" shown separately; **What's next** (your rent share and when it's
  due, payments waiting for you to confirm); the shared fund's balance; and
  short links to Rent, Shared expenses and Shared fund (where you add things,
  unchanged). It only says **All settled up** when nothing is owed at all,
  rent included (§11.2).
- **Activity:** every money event in the household, newest first, grouped by
  month: expenses, rent shares, payments, fund. Payments waiting for
  confirmation are marked.
- **Balances:** who owes whom in the household, each line split into rent and
  shared expenses; your own lines stand out.
- **Home:** "You owe" now uses the same numbers (rent included), with the
  split shown underneath.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 181 (+4: the page's numbers include rent, split by source;
      "All settled up" never shows while rent is owed; Home's "You owe" uses
      the ledger)
- [x] Lint: no new errors (65)
- [x] CI green on GitHub (7873c75)
- [x] Deployed to apptmasters.com 2026-10-10 (no database change; checked
      with a real household)

**Your test on apptmasters.com**
1. Open the **Money** tab. Overview shows what you owe and are owed, and
   what's next.
2. In **Rent**, create this month's rent (or use one that isn't confirmed).
   Back on Money, a roommate's account shows that rent under **You owe** and
   doesn't say "All settled up".
3. **Activity** lists the rent shares and recent expenses, newest first.
4. **Balances** shows each pair with rent and shared expenses separately.
5. Confirm the rent payment in **Rent**. Money updates: that rent leaves
   "You owe", and Activity shows the payment.
6. Home shows "You owe $…" with the same total as Money.

**Sign-off:** [x] Approved on 2026-10-10

### 5c — Record a payment

**Status:** Approved

**What I'm building** (§13.2: record payment → reduce what's owed → keep the
history)
- **Record payment:** on Money → Balances, next to anyone you owe. It lists
  everything you owe that person: shared-expense shares and rent months, all
  ticked; untick what you're not paying now. If they owe you something too,
  it's subtracted (also listed, can be unticked). Choose how you paid (cash,
  bank transfer, Venmo, Zelle, Cash App, PayPal, other), add a note, send.
- **The receiver confirms:** they get a notification, and their Money Overview
  shows "*Sam* says they paid you $…" with **Confirm** and **Decline**.
  Confirm marks every item it covers as paid. Decline puts them back as they
  were. The sender can **Cancel** while it's waiting.
- **Nothing is deleted:** each payment is one line in Activity, with what it
  covered. Shared expenses and Rent show the same items as paid.
- One new database table (payments), added with targeted SQL.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 186 (+5: only items you really owe that person can be
      included; the total subtracts what they owe you and must be more than
      zero; waiting payments don't count yet; confirm marks expenses and rent
      paid; decline and cancel put everything back; only the receiver
      confirms; the Money check still matches)
- [x] Lint: no new errors (65)
- [x] CI green on GitHub (c9beb6d)
- [x] Deployed to apptmasters.com 2026-10-10 (payments table added with
      `prisma/manual-sql/2026-10-10-sprint-5c-payments.sql`; checked with a
      real household)

**Your test on apptmasters.com** (two accounts in the same home)
1. Make sure the first account owes the second something: an unpaid shared
   expense and/or an unconfirmed rent month.
2. First account: Money → **Balances** → **Record payment** next to the
   second person. Everything owed is listed and ticked. Untick one item; the
   total changes. Pick **Cash**, then **Send**.
3. Overview now says "Waiting for *Name* to confirm".
4. Second account: Money → Overview shows "*Name* says they paid you $…".
   Tap **Confirm**.
5. Both accounts: Balances no longer shows the paid items; the unticked one
   is still owed. Activity shows one payment line.
6. Record another payment and **Decline** it on the second account: nothing
   changes in what's owed.

**Sign-off:** [x] Approved on 2026-10-15

---

## Sprint 6 — Shopping → Money

**Status:** Approved (6a, 2026-10-15) · Spec: `PRODUCT_LOGIC.md` §10.7, §10.8, §13.1

Finishing a shopping trip creates the grocery expense by itself: nobody adds
it by hand any more.

### 6a — The trip's total becomes the grocery expense

**Status:** Approved

**What I'm building**
- **Review the split at checkout:** after entering the total and receipt, the
  review shows **Split between**: everyone in the home (not guests), ticked,
  except people who are away (shown as "away", unticked), with each person's
  share ("$28.20 each"). Untick anyone who shouldn't pay (§10.8).
- **"I've left the store" saves the grocery expense** (§10.8): paid by the
  shopper, the total typed at checkout, the receipt attached, category
  Groceries, split equally between the ticked people, by the same rules as
  Add Expense. Then the turn passes on, as before.
- **Everyone in the split is told** "*Alex* finished shopping: your share is
  $28.20". Balances, Money and Home update straight away; the expense is on
  the Shared expenses page like any other.
- **The Shopping page** shows the last trip's total and how it was split.

**Decisions I made (tell me if you disagree)**
- The shopper is in the split by default, like any payer; untick them if they
  bought only for the others.
- Shares are rounded to the cent the same way as Add Expense.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 192 (+6: leaving the store creates one expense with the right
      total, payer, receipt and shares; unticked and away people aren't
      charged; the split must name people who live here; balances and Home
      include it; the Money check still matches; Add Expense keeps working)
- [x] Lint: no new errors (65)
- [x] CI green on GitHub (ecd078f)
- [x] Deployed to apptmasters.com 2026-10-15 (2 trip columns added with
      `prisma/manual-sql/2026-10-15-sprint-6a-trip-expense.sql`; checked
      with a real household; no trips were open, so no old test totals turn
      into expenses)

**Your test on apptmasters.com** (two or three accounts in the same home)
1. On the shopper's account, go through a trip to the checkout card. Enter a
   total (say $30) and a receipt, tap **Review and validate**.
2. The review shows **Split between** with everyone ticked and "$10.00 each"
   (for three people). Untick one person: it becomes "$15.00 each". Tap
   **Validate**, then **I've left the store**.
3. On another account in the split: a notification "*Name* finished
   shopping: your share is $15.00", and Money → **You owe** includes it.
4. The unticked person owes nothing for it.
5. **Shared expenses** shows "Groceries" with the receipt, paid by the
   shopper. Nobody had to add it.

**Sign-off:** [x] Approved on 2026-10-15 (both decisions accepted)

---

## Sprint 7 — Rent

**Status:** Approved (7a and 7b, 2026-10-15) · Spec: `PRODUCT_LOGIC.md` §12, §22

Rent has two separate facts (§12.1): **was the landlord paid?** and **has each
roommate paid back the rent payer?** Today one tap ("I paid the rent") records
both at once.

### 7a — This month: landlord paid vs. roommates reimbursed

**Status:** Approved

**What I'm building**
- **A "This month" card on Rent** (§12.2): total rent; **Landlord**: "Paid
  to *landlord* on Oct 4" or "Not paid yet"; **Collected**: "$650 of $1,300";
  each roommate's status: **Paid**, **Says paid, waiting for *rent payer***,
  or **Not paid** (red once it's late); and **Still to collect**.
- **"I paid the landlord"** is its own button for the rent payer (they can
  undo it). Starting a month's rent no longer marks the landlord paid; months
  already recorded keep "paid to landlord".
- **Starting this month's rent** (rent payer or admin) sets everyone's share;
  in 7b this happens by itself.
- **Send reminder** can be used by the rent payer as well as admins, and only
  goes to roommates who haven't paid (not to those waiting for confirmation).
- **History** (§12.3): one line per month, e.g. "September 2026 · Paid" or
  "October 2026 · $650 still to collect"; tap a month to open its details
  instead of a big card for every month.
- **Removed:** the "Auto-rotate rent payer" checkbox, because it never did anything
  (it comes back in 7b, working), and the Venmo / PayPal / Cash App shortcuts,
  which used the person's name instead of their account and rarely worked.
  Marking your share paid still asks how you paid.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 198 (+6: landlord paid is separate from collection; only the
      rent payer or an admin can mark it or start a month; collected,
      waiting and still-to-collect amounts; reminders only to people who
      haven't paid, sent by the rent payer or an admin; history newest first)
- [x] Lint: no new errors (65 → 64)
- [x] CI green on GitHub (1af0f5d)
- [x] Deployed to apptmasters.com 2026-10-15 (no database change; checked
      with the household that uses rent: its 4 months load, all marked
      "landlord paid", amounts add up)

**Your test on apptmasters.com** (rent payer and a roommate)
1. Money → **Rent**. October's card shows the total, "Landlord: paid…" (it
   was recorded before), how much is collected, and each roommate's status.
2. On the rent payer's account, tap **Undo** next to "Landlord: paid", then
   **I paid the landlord** again. The landlord line changes; what roommates
   owe doesn't.
3. Below, **History** lists the earlier months, one line each. Tap one: its
   details open.
4. (When a roommate still owes for a month) on the rent payer's account, tap
   **Send reminder**: only roommates who haven't paid get it.

**Sign-off:** [x] Approved on 2026-10-15

### 7b — Rent that runs by itself

**Status:** Approved

**What I'm building** (§12, §22: "rent share becomes due → Money balance;
reminder; Home priority")
- **Each month starts by itself** 3 days before its due day: everyone's
  share is set and appears in Money. It happens in the daily job (9:00) and
  whenever someone opens Rent, Money or Home. It only starts the month that is
  coming due (up to a week after the due day). Older months are never filled
  in.
- **When a month starts**, roommates get "October's rent: your share of $400
  is due Oct 23. Pay *Sam*." and the rent payer gets "October's rent has
  started. Pay the landlord by Oct 23."
- **Reminders by themselves:** on the due day, and again 3 and 10 days later,
  to roommates who haven't paid; and to the rent payer while the landlord
  isn't marked paid. At most one rent reminder per person per day.
- **Home** shows the rent payer "Pay the landlord: October rent, due Oct 23"
  (red once late) until they tap **I paid the landlord**.
- **Rotate the rent payer each month** is back in the setup, and works now:
  when a new month starts, the next person (in the order people joined) pays
  the landlord and collects the shares.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 207 (+9: a month starts in its window and only once; never
      before it or long after; next month's rent starts at the end of this
      month when it's due on the 1st; roommates and the rent payer are told;
      reminders on the due day and when late, only to people who haven't
      paid, at most once a day; the landlord item on Home; rotation)
- [x] Lint: no new errors (64)
- [x] CI green on GitHub (77928f2)
- [x] Deployed to apptmasters.com 2026-10-15 (no database change). Ran the
      daily rent job once by hand: started 0 months, sent 0 reminders, as
      expected (the household using rent has October recorded and paid;
      November starts by itself on Nov 20)

**Your test on apptmasters.com** (a household where this month's rent isn't
recorded yet, e.g. a test household with two accounts)
1. As a household admin: Money → **Rent** → **Set up rent** (or **Edit
   setup**), with the due day **2 days from today**. Save.
2. The page now shows this month's card by itself: nobody had to start it.
   The roommate's account got "…your share of $… is due …".
3. The rent payer's **Home** shows "Pay the landlord: … rent, due …". Tap it,
   then **I paid the landlord**: the Home item goes away.
4. In **Edit setup**, tick **Rotate the rent payer each month** and save.
   (You'll see it work when next month starts.)
5. Reminders on the due day and when late arrive by themselves; nothing to
   tap.

**Sign-off:** [x] Approved on 2026-10-15

---

## Sprint 8 — Maintenance

**Status:** Approved (8a and 8b; 2026-10-16) · Spec: `PRODUCT_LOGIC.md` §14

A repair goes **Reported → Acknowledged → Scheduled → In progress →
Completed**, then the resident confirms it's fixed (**Resolved**) or says it
isn't (back to the landlord).

**Owner's decision (2026-10-15):** when the home's landlord is on Apartment
Masters (linked as its manager), they move a request along in their portal.
When no landlord is linked (all homes today), **household admins** record the
landlord's answers on the Maintenance page, so requests never get stuck.

### 8a — The repair steps and scheduling

**Status:** Approved

**What I'm building** (§14.1–14.4)
- **Report a problem:** what, details, **where in the home** (suggestions
  from your Rooms), priority, and an optional **photo**.
- **The steps:** Reported → Acknowledged → Scheduled → In progress →
  Completed, each with an optional note. Requests that were "Open" become
  "Reported".
- **Scheduling a visit** takes a date and a time window. It puts **"Repair:
  *title*"** on the household **Calendar** (moved if it's rescheduled),
  tells everyone at home (also by email) with the visit time, and shows under
  **Coming up** on Home.
- **A timeline on each request:** who did what, when, with their notes.
- **Who moves it:** the linked landlord in their portal; otherwise household
  admins, with an **Update** button on each request. The page says which.
- **Telling people:** the person who reported is told at each step;
  household admins (when no landlord is linked) see "Tell the landlord:
  *title*" on Home for new reports; urgent repairs stay at the top of Home
  until they're completed.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 215 (+8: steps only go forward, rescheduling allowed; who may
      update with and without a landlord; scheduling creates and moves the
      calendar event; timeline; notifications; Home items; photo uploads are
      real images; old "Open" requests show as "Reported")
- [x] Lint: no new errors (64 → 63)
- [x] CI green on GitHub (e39e420)
- [x] Deployed to apptmasters.com 2026-10-15 (new request fields and the
      timeline table added with
      `prisma/manual-sql/2026-10-15-sprint-8a-maintenance.sql`; the one
      existing request is now "Reported" with its first timeline entry)

**Your test on apptmasters.com** (an admin and a non-admin in the same home)
1. More → **Maintenance** → **Report a problem**: a title, **where**
   (e.g. Bathroom), a priority, optionally a photo. It shows as
   **Reported**. The admin's Home shows "Tell the landlord: …".
2. On the admin's account, tap **Update** → **Acknowledged** with a note
   ("Landlord will send a plumber"). The reporter gets a notification; the
   request's timeline shows it.
3. **Update** → **Scheduled**: tomorrow, 2 PM to 4 PM. The request shows
   "Repair visit: …"; **Calendar** has "Repair: …"; everyone got a
   notification; Home shows it under **Coming up**.
4. **Update** → **In progress**, then **Completed**.
5. On the non-admin's account there's no **Update** button.

**Sign-off:** [x] Approved on 2026-10-15

### 8b — "Is it fixed?"

**Status:** Approved

**What I'm building** (§14.5: "completed" doesn't automatically mean "fixed")
- **After Completed**, the person who reported the problem (or a household
  admin, if they've moved out) sees **"Is it fixed?"** on Home and on the
  request, with two answers:
  - **Yes, it's fixed** → **Resolved**. It moves to the Resolved list.
  - **No, still a problem** (with a note: what's still wrong) → back to
    **Reported**, so the landlord side starts again. The note goes on the
    timeline as "Still a problem", and an old visit is cleared so a new one
    gets its own calendar entry.
- **The landlord side is told** either way: household admins in the app
  (when no landlord is linked; "Tell the landlord" comes back on their Home
  after "still a problem"), or the linked landlord by email, and their
  portal shows the resident's note.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 219 (+4: only after Completed; only the reporter (or an admin
      once they've moved out) answers; fixed → resolved; still a problem
      needs a note and goes back to reported with the visit cleared; the
      landlord side is told; Home asks "Is it fixed?")
- [x] Lint: no new errors (63)
- [x] CI green on GitHub (0a36daf)
- [x] Deployed to apptmasters.com 2026-10-15 (together with 9a and 9b; two
      columns added with `prisma/manual-sql/2026-10-15-sprint-8b-confirm-fix.sql`)

**Your test on apptmasters.com** (the reporter's account and an admin's)
1. Take a request to **Completed** (as in 8a).
2. On the reporter's account, Home shows "Is it fixed? *title*". On the
   request, tap **No, still a problem**, write what's still wrong, send. It's
   back to **Reported**, and the timeline shows "Still a problem" with the
   note. The admin's Home shows "Tell the landlord: …" again.
3. Move it to **Completed** again (admin), then on the reporter's account
   tap **Yes, it's fixed**. It moves to **Resolved**.
4. A roommate who didn't report it isn't asked.

**Sign-off:** [x] Approved on 2026-10-16

---

## Sprint 9 — Calendar + Notifications

**Status:** Approved (9a and 9b; 2026-10-16) · Spec:
`PRODUCT_LOGIC.md` §15, §20, §21

### 9a — A calendar that builds itself

**Status:** Approved

**What I'm building** (§15: "aggregate events generated by other modules
instead of forcing duplicate event entry")
- The **Calendar** shows, next to household events and repair visits:
  - **Rent due** each month (with "landlord paid" or what's still to
    collect);
  - **Cleaning turns** coming up ("Cleaning: Sam"), and recent cleanings;
  - **Shopping**: trips done ("Shopping: Alex · $30.00") and whose turn it
    is now;
  - **Who's away** (from Members → travel);
  - **Chores** with a due date.
- These entries are made by the app: nobody types them, they can't be edited
  or deleted on the Calendar, and tapping one opens the page where it's
  handled (Rent, Cleaning, Shopping, Members, Chores).
- Household events and repair visits work as before.
- **Fixed on the way:** the Calendar's list view showed "Invalid Date" for
  every event, and timed events (repair visits) could appear on the wrong
  day in the evening; both now show the viewer's own day.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 222 (+3: each module's entries appear on the right day; they're
      read-only and link to their page; nothing is stored twice)
- [x] Lint: no new errors (63)
- [x] CI green on GitHub
- [x] Deployed to apptmasters.com 2026-10-15 (checked: 26 app-made entries
      for the household that uses rent, all linked to their pages)

**Your test on apptmasters.com**
1. More → **Calendar**. This month shows the rent due day, upcoming cleaning
   turns, who's away and the repair visits, without anyone adding them.
2. Tap a cleaning turn: it opens Cleaning. Tap rent: it opens Rent.
3. These entries have no Edit or Delete. Household events you add still do.

**Sign-off:** [x] Approved on 2026-10-16

### 9b — One notification service

**Status:** Approved

**What I'm building** (§20: one service, event types, channel preferences,
importance, anti-spam)
- **Every notification has a category:** Rent, Money, Cleaning, Shopping,
  Maintenance, Household, Messages.
- **Profile → Notifications:** for each category, choose **push** and
  **email**. In-app notifications always stay on (they're the record on the
  bell and on Home). The two switches you have today (all push, all email)
  stay as master switches.
- **Defaults keep today's behavior:** nothing changes until someone turns
  something off. Emails still only go out for what already sends one (rent
  reminders, repair visits, payments…).
- **No buzzing in a row:** after a push or email in a category, more from
  the same category within 2 minutes only appear in the app. Important ones
  (a repair visit scheduled, rent due or late) always come through.
- **Everything goes through the one service:** 9 places that wrote
  notifications directly (cash payments, expense changes, travel,
  room escalations…) now respect the settings too, and send a push like the
  rest.

**Decision I made (tell me if you disagree):** in-app can't be turned off,
only push and email.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 229 (+7: each type's category; push and email follow the
      category settings and the master switches; the 2-minute quiet period;
      important ones still go through; in-app always created; settings saved
      and read back with defaults)
- [x] Lint: no new errors (63)
- [x] CI green on GitHub
- [x] Deployed to apptmasters.com 2026-10-15 (no database change)

**Your test on apptmasters.com** (two accounts in the same home; account B
has allowed notifications on its phone or browser)
1. On account B: **Profile → Notifications** shows the categories, each with
   **Push** and **Email**. Turn **Push** off for **Shopping**.
2. Make B the shopper and tap through to **I'm at the store**. On account A,
   add an item to the list. B sees it on the bell, but gets no push.
3. On B, turn **Push** back on for **Shopping**. A adds another item: B gets
   a push. A adds a third right away: it shows on the bell, without a second
   buzz (2-minute quiet period).

**Sign-off:** [x] Approved on 2026-10-16

---

## Sprint 10 — Household Issues and Insights

**Status:** Approved (10a and 10b; 2026-10-16)
· Spec: `PRODUCT_LOGIC.md` §17, §18, §19

Already done in Sprint 1: the More menu follows the blueprint's groups (§17),
and calls live in Chat.

**Owner's decisions (2026-10-15)**
- A proposed resolution is accepted (or declined) by **the person who raised
  the issue**; household admins can still close an issue that's stuck.
- Issues are visible to **everyone at home**, but the person raising one can
  mark it **private**: then only they, the person it involves and household
  admins see it.

### 10a — Household Issues (replaces Disputes)

**Status:** Approved

**What I'm building** (§18: "Issue created → Open → Discussion → Proposed
resolution → Resolved")
- **Raise an issue:** a topic (**Noise, Cleaning, Shared expenses, Rent,
  Guests, Other**), a title, what's going on, optionally **who it involves**
  (instead of "against"), and **Private** (see above).
- **The steps:** **Open** → **Discussion** (as soon as anyone replies) →
  **Proposed resolution** (anyone suggests one: "Quiet hours after 10 pm") →
  **Resolved** when the person who raised it accepts. If they decline, it
  goes back to Discussion with their reason. Admins can **close** a stuck
  issue.
- **One timeline per issue:** replies, proposals, accepted or declined.
- **Wording everywhere:** "Household issues", never "dispute". Existing
  disputes carry over: open ones become Open (or Discussion if they have
  replies), resolved stay Resolved, dismissed become Closed.
- **Telling people:** the person it involves and household admins when an
  issue is raised (only them for private ones); the raiser when there's a
  reply or a proposal; everyone who can see it when it's resolved. Home shows
  the raiser "Proposed resolution: *title*. Accept or decline".
- Database: a few new fields (topic, private, proposal) and a kind for
  timeline entries, added with a reviewed SQL file.
- Not changed here: the "Dispute" button on a single expense (Shared
  expenses), which flags one expense; it's a separate feature.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 234 (+5: topics and who it involves; who's told; reply →
      discussion, propose → proposed, decline needs a reason, accept →
      resolved; only the raiser accepts; one proposal at a time; close by the
      raiser or an admin; private issues hidden from others; old dismissed
      disputes show as closed)
- [x] Lint: no new errors (63 → 60)
- [x] CI green on GitHub (92f741a)
- [x] Deployed to apptmasters.com 2026-10-16 (new fields added with
      `prisma/manual-sql/2026-10-16-sprint-10a-household-issues.sql`; the one
      existing dispute was already resolved and shows as Resolved; old Disputes
      links open Household issues)

**Your test on apptmasters.com** (three accounts: A raises, B is involved, C is
another roommate)
1. A: More → **Household issues** → **Raise an issue**: topic **Noise**,
   involves **B**. B and the admins get a notification.
2. B replies: it's now **Discussion**. B proposes "Quiet hours after 10 pm":
   **Proposed resolution**, and A's Home shows "Proposed resolution: …".
3. A taps **Decline** with a reason: back to **Discussion**. B proposes again;
   A taps **Accept**: **Resolved**, and everyone who can see it is told.
4. A raises a second issue marked **Private** involving B: C doesn't see it;
   B and the admins do.

**Sign-off:** [x] Approved on 2026-10-16


### 10b — Insights (one page instead of Stats and Analytics)

**Status:** Approved

**What I'm building** (§19: "aggregate existing source data… use the same Money
ledger")
- **Money** (last 6 months): household spending by month and by category;
  **your share** each month (including your own part of what you paid); rent
  history per month: expected, collected, landlord paid (the same numbers as
  Money → Rent); who owes whom now, from the ledger (the same as Money →
  Balances).
- **Household** (last 3 months): cleanings done per person, shopping trips per
  person (and their totals), chores done and overdue per person.
- **One "Insights" entry in More** replaces Stats and Analytics; their old
  links open Insights. Roommate scores stay where they are.
- Today's Stats and Analytics each add things up their own way (no rent;
  "owed" means "shared in"; "my share" leaves out your part of what you paid);
  Insights fixes that by using the same sources as Money.
- A member's profile page shows the same numbers ("Paid for the home",
  "Their share", chores), labeled with their period.
- Charts: one color, a brighter step of the brand green, checked for contrast
  in light and dark mode; a value on each month, a readout on hover or tap,
  and a table view.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 239 (+5: months and categories over 6 months; your share
      includes your part of what you paid; everyone's shares add up to the
      household's spending; rent and who owes whom equal Money's numbers;
      cleanings, trips and chores over 3 months; members only)
- [x] Lint: no new errors (60)
- [x] CI green on GitHub (a9dd550)
- [x] Deployed to apptmasters.com 2026-10-16 (no database change; checked with
      the household that uses rent: everyone's shares add up to its spending;
      old Stats and Analytics links open Insights)

**Your test on apptmasters.com**
1. More → **Insights**. This month's spending and categories match Shared
   expenses; the rent months match Money → Rent; who owes whom matches Money →
   Balances.
2. Household: the cleanings and shopping trips per person match Cleaning →
   History and Shopping.
3. Old Stats or Analytics links (if bookmarked) open Insights.

**Sign-off:** [x] Approved on 2026-10-16

---

## Sprint 11 — Marketplace → My Home

**Status:** 11a ready for your test · Spec: `PRODUCT_LOGIC.md` §1, §2.1, §3.2–3.3, §4

The last step of the journey: **Find a Home → Create / Join My Home → Live &
Manage Together**. Finding a place is self-reported: the app asks, it never
assumes a lease was signed (§1).

**Owner's decisions (2026-10-16)**
- **When to ask "Have you found your new home?":** 14 days after someone signs
  up, or 7 days after they first message a listing owner, whichever comes
  first. After "I'm still looking", again 14 days later. Never more than once
  in 14 days.
- **Move-in date:** members count from their move-in date. Until then they get
  no rent share, no cleaning or shopping turn, and aren't in shared expenses by
  default (like being away). Rent: someone pays a month if they've moved in by
  that month's due day.

### 11a — "Have you found your new home?"

**Status:** Ready for your test (the daily email waits for your OK)

**What I'm building** (§3.2–3.3)
- **Who's asked:** signed-in people looking for a home (no home yet, not
  waiting to join one, haven't said they found one), at the times above.
  Not asked: property managers and platform admins, and people who only post
  listings (they're offering a place), unless they also message a listing
  owner.
- **Where:** a card at the top of **Listings**: "Have you found your new
  home?" with **Yes, I found a place** and **I'm still looking**. A daily job
  also asks by email and phone notification (a person without a home has no
  in-app bell yet), never more than once in 14 days. It follows the person's
  settings (Profile → Notifications → Household). The email's **Answer**
  button opens Listings with the card, asking to sign in first if needed.
- **I'm still looking:** the card goes away for 14 days.
- **Yes, I found a place:** they become "Found a home" (§2.1) and go to set
  up their home. Until Home Setup exists (11b) that's **Create apartment**,
  which now also links to **Join their home** (invite code). After signing in,
  they land there until they have a home.
- **Moving out:** someone who moves out of their home starts a new search; the
  question comes 14 days later (an old "I found a place" no longer counts).
- Database: two dates on each person (last asked, last "still looking"), added
  with a reviewed SQL file (`prisma/manual-sql/2026-10-16-sprint-11a-home-question.sql`).
  The daily job needs one line in the server's schedule: before turning it on
  I'll tell you how many people its first run would email (a count only), for
  your OK.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 259 (+20: due 14 days after sign-up or 7 days after the
      first message to someone else's listing, whichever is first; 14 days
      after "still looking"; never for members, people waiting to join,
      managers, or people who only post listings; moving out starts a new
      search; the answers and where they lead; the daily job emails and pushes
      once, not again for 14 days, follows settings, and can count without
      sending)
- [x] Lint: no new errors (60)
- [x] CI green on GitHub (934a4ab)
- [x] Deployed to apptmasters.com 2026-10-16 with the SQL file (11 accounts,
      the two new dates empty; all pages and APIs answer)
- [x] Email fix (1c5d932, +2 tests, 261): our email service (Resend) refuses
      more than about 2 emails a second without raising an error, so the job
      now sends one at a time with a pause; when email was the only way to
      reach someone and it failed, the next day's run tries again
- [x] Dry run on the live data: nobody is due today. The 4 accounts without a
      home signed up 8 and 11 days ago and haven't messaged a listing owner:
      2 become due in 3 days, 2 in 6 days
- [ ] Daily job in the server's schedule (after your OK): every day at 14:00
      UTC (10 am New York)

**Your test on apptmasters.com** (an account without a home is "due" 14 days
after signing up; none is yet, so name two accounts without a home, A and B,
and I'll move their sign-up dates back two weeks, then put them back after
the test)
1. Sign in as A and open **Listings**: at the top, a card asks "Have you found
   your new home?". Don't answer yet.
2. The email (once the daily job is on; I can run it once right away): A gets
   one email "Have you found your new home?". Its **Answer** button opens
   Listings with the card (asking you to sign in first if you're signed out).
   The next day, no second email.
3. As A, tap **I'm still looking**: the card is replaced by "We'll check in
   again in two weeks". Reload: no card.
4. As B, open Listings and tap **Yes, I found a place**: you're taken to
   Create apartment, which has a **Join their home** link. Sign out and in
   again: you land there again.
   *(Since 11b and Sprint 12: the card is also on Home, and "Yes, I found a
   place" opens **Create a Home**, with "Join their home" at the bottom.
   Since 13c: the card is on **Home only**, and the email's Answer button
   opens Home.)*

**Sign-off:** [ ] Approved on ____  · Issues found: ____

### 11b — Home Setup: Create a Home / Join a Home, with a move-in date

**Status:** Ready for your test (the owner's designs, 2026-10-16)

**Design:** [`docs/mockups/create-home-mobile.jpg`](mockups/create-home-mobile.jpg),
[`docs/mockups/join-home-mobile.jpg`](mockups/join-home-mobile.jpg). Left out
because the app doesn't have them (owner: "everything we don't have, don't
take into account"): apartment type, bedrooms and total residents of a home,
the "initial settings" switches, invites by phone, finding a home to ask to
join without a code, and the message and phone number in a join request.

**What I'm building** (§4: "I found a place → Found through Apartment
Masters? → Select/enter home → Move-in date → Create My Home → Invite
roommates"; `MARKETPLACE_FLOW.md` §22–24)
- **Create a Home**, three steps with a progress bar:
  1. **Basic info:** "Found it on Apartment Masters?" Pick the listing you
     messaged its owner about: its title and city fill in (the street address
     stays private to the advertiser, who shares it in Messages, so you type
     it). Home name, address, move-in date (optional).
  2. **Members:** invite roommates by email (sent when the home is created);
     you're shown as the household admin.
  3. **Review**, then **Create My Home**: you land in your new home.
- **Join a Home:** enter the invite code (filled in from an invite email) →
  **review the home** (name, address, how many members) → your move-in date →
  **Send request** → "Request sent" (sent ✓, under review, response) → a
  **Join status** page with your requests. While waiting, signing in lands
  there. The household admin approves, as today.
- **Move-in date in action:** until someone's move-in date, rent months,
  cleaning and shopping turns and default expense splits leave them out (as
  if they were away); after it, they're counted. Rent: someone pays a month if
  they've moved in by that month's due day. The household page shows "Moving
  in on …", and the calendar shows the move-in day.
- The old Create apartment and Join pages are replaced by these.
- **Two quick fixes from the Sprint 12 review** (live problems today):
  - A listing's exact street address is visible only to its poster and
    admins, on the page and in its data; everyone else sees the city (owner's
    decision: the address is shared in the conversation). 1 of the 3 live
    listings shows one today.
  - On phones, the Listings header gets a menu (Browse, Post a listing, My
    listings, Messages); today those links are hidden on small screens.
- Database: a move-in date on each membership, added with a reviewed SQL file.
- Also fixed: someone whose join request is still waiting no longer gets the
  household navigation (Listings, Profile, Admin counted a waiting request as
  a home); a refused request now sends the person an email; the public
  listings list no longer returns internal review fields.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 275 (+14: create with a move-in date; join preview, request,
      limits on tries, Join status, refusal email; rent counts people moved in
      by the due day; default splits, shopping and cleaning turns skip people
      not moved in; the calendar's move-in day; the street address hidden from
      everyone but the poster and admins)
- [x] Lint: no new errors (59, one fewer)
- [x] Screens checked on phone and desktop sizes on a local copy
- [x] CI green on GitHub (8ccf353)
- [x] Deployed to apptmasters.com 2026-10-16 with the SQL file (6 memberships, the
      new date empty, so nothing changes for existing homes; all pages answer)

**Your test on apptmasters.com**
1. **Create:** signed in without a home (e.g. A), open **Create a Home** (from
   "Yes, I found a place" on Listings). Basic info: if you messaged a listing
   owner, pick that listing; its title and city fill in; type the street
   address; move-in date two weeks from today. Members: invite a second
   account by email. Review → **Create My Home**: you're in your new home as
   its admin, and the invite email arrives.
2. **Join:** with the second account (no home), open the invite email's link:
   the code is filled in. Review shows the home's name, address and member
   count. Choose a move-in date in the past → **Send request** → "Request
   sent". Sign out and in: you land on **Join status**.
3. **Approve** the request as the admin. The household page shows the admin
   "Moving in on …" (two weeks from now). Create a cleaning rotation with both
   of you: the admin's turns are skipped until their move-in date. The
   calendar shows the move-in day.
4. **Rent:** set up rent with the second account as the rent payer: this
   month's rent gives the admin (not moved in by the due day) no share.
5. Open the listing that has a street address, signed out and as another
   account: only the city shows. As its poster, you still see the address
   (and can edit it).
6. On a phone, signed in without a home: the Listings header has a menu with
   Browse, Post a listing, My listings and Messages.
   *(Replaced in Sprint 12: the phone bar at the bottom has Home, Saved,
   Messages and More; More has My listings and Post a listing.)*

**Sign-off:** [ ] Approved on ____  · Issues found: ____

---

## Sprint 12 — Find a Home (Marketplace / Pre-Household)

**Status:** 12a–12e live, ready for your test (built together at the owner's request, 2026-10-16) · Spec:
[`MARKETPLACE_FLOW.md`](MARKETPLACE_FLOW.md) (the owner's document,
2026-10-16), `PRODUCT_LOGIC.md` §1–§4

The first service of the journey: **Search → Register → Save / Contact →
Create or Join Home**. Public browsing first; an account only for personal
actions. Detailed test steps are written when each slice starts.

**Owner's decisions (2026-10-16)**
- **Order:** after 11b (which already covers Create / Join a Home, §22–24).
- **Fees:** listings may state a broker fee and an application fee; both are
  shown and filterable, and the "Find a place, no broker fee" headline
  changes.
- **Exact address:** shared only in the conversation, when the advertiser
  chooses. Public pages show city, neighborhood and an approximate map area.
- **Map and radius:** the last slice, once the owner picks a map service
  (account and key needed).
- **The filters' data (approved 2026-10-16):** the listing form asks what the
  document's filters need and saves it with the listing (a database
  addition). Everything else taken from the pictures is front end only.
- **Design:** the owner's pictures in [`docs/mockups/`](mockups/): Home,
  search results, Filters, listing details, Saved, Messages, a conversation
  and More on phones; Find a Home, Messages and Saved on desktop. Left out
  because the app doesn't have them: ratings and reviews, "verified" badges,
  online status, "Schedule viewing", calls in marketplace messages, photos and
  voice in marketplace messages, square feet, nearby places (subway, grocery),
  "Recommended for you" (shown as the latest listings), saved searches and
  folders, household chats inside marketplace Messages.

**My proposals in the review (owner can change them at each slice):**
- "Found a home" and the "Have you found your new home?" question (11a) stay,
  as a moment inside "Registered / No Home" that leads to Create or Join.
- The listing form collects what the filters need: max occupants (required),
  neighborhood, ZIP, room type, furnished, lease duration, utilities,
  internet, private bathroom, laundry, parking, elevator, pets, smoking,
  accessibility, broker fee, application fee. Older listings are asked to
  fill them in; until then they don't match those filters (an occupants
  search leaves out listings that don't state their capacity, as §5 says).
- Posters can **mark a listing as rented / unavailable**: hidden from search,
  still shown (labeled) in Saved and in conversations.
- For people without a household, **Home** is the landing page (hero and
  quick search) and **Find a Home** is the full search.
- People without a household get the **notification bell** (new messages,
  listing approved or rejected, a saved listing no longer available, "Have
  you found your new home?"), which needs one small database change.
- **Search History:** the last 10 searches, clearable; optional, last slice.
- Later: "report conversation" and "block user" in Messages.

| Slice | What it adds | Status |
|---|---|---|
| **12a — One header, More, How It Works** | One header on every Find a Home page (visitors: Home, Find a Home, How It Works, More, Log in, Sign up; signed in: Home, Find a Home, Messages, Saved, How It Works, More, avatar) and a phone bar (Home, Saved, Messages, More); Home for people without a home (search, quick filters, Already have a place?, latest listings); More, How It Works and Help pages; the same ApptMasters logo everywhere | Ready for your test |
| **12b — What a listing says** | The new listing details on the form (how many people required; property and room type, neighborhood, ZIP, lease, laundry, smoking, what's included, broker and application fee); the street address private; the headline no longer promises "no broker fee" | Ready for your test |
| **12c — Search that matches** | Every filter except radius, in the page address; removable chips and Clear all; Whole places / Rooms tabs with counts; sort; "Show more"; an honest empty state; Filters screen on phones, side panel on desktop; "Back to results" keeps the search | Ready for your test |
| **12d — Save and Saved** | Hearts on cards and the listing page; a visitor who taps Save signs up or in and comes back with it saved; Saved page (search, sort, kinds, unavailable listings labeled); "You've already messaged" on the listing | Ready for your test |
| **12e — Messages** | Inbox with the listing in each conversation; a conversation with the listing on top (phones) or beside it (desktop, three panels: conversations, chat, listing) | Ready for your test |
| **12f — Map, radius, Search History, bell** | After the owner picks a map service: map and radius. Search History. The notification bell for people without a home (needs notifications that don't belong to a household) | Not started (owner, 2026-10-16: not for now) |

**Left out from the pictures** (the app doesn't have them): ratings, "verified"
badges other than the email confirmation every account has, online status,
calls, photos and voice in marketplace messages, "Schedule viewing", square
feet, nearby places, folders and saved searches in Saved, household chats in
marketplace Messages.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 288 (+13 Find a Home: filters in the page address and as
      chips, odd values ignored; occupants only match a declared capacity;
      bedrooms 3+, details, laundry, smoke-free, no broker fee, lease, recently
      listed; move-in date; place by city, neighborhood or ZIP, tab counts,
      price sort; nothing private sent; a new listing must say how many people;
      Saved needs an account, saves once, keeps unavailable listings, removes,
      only visible listings)
- [x] Lint: no new errors (51, down from 59)
- [x] Production build passes on this PC; screens checked at phone and desktop
      sizes on a local copy
- [x] CI green on GitHub (114be0d)
- [x] Deployed to apptmasters.com 2026-10-16 (114be0d) with
      `prisma/manual-sql/2026-10-16-sprint-12-find-a-home.sql` (owner approved);
      live checks all 200. The 3 live listings have the new details empty, so a
      People search finds none until their owners edit them

**Your test on apptmasters.com** (phone and desktop)
1. **Signed out:** Home has the search with "People". Search "Brooklyn" (or
   your city): Find a Home lists matching places. The header shows Log in and
   Sign up; the phone bar shows Home, Find a Home, Saved, More.
2. **Filters:** on the phone tap Filters (on desktop, the panel on the left).
   Choose 2 people and Furnished, then "Show N listings". Each filter shows as
   a chip; tap one to remove it, or Clear all. The Whole places / Rooms tabs
   show how many each. Sort by price. Filters that match nothing show "No
   listings match these filters", never other listings.
3. **A listing:** photos with the heart and share, the facts, What's included,
   Lease and fees. No street address anywhere (only the neighborhood).
4. **Save as a visitor:** tap Save → sign up or log in → you're back on the
   same listing, saved (a "Saved" message shows).
5. **Saved:** the listing is there; search and sort work; the heart removes it.
6. **Contact:** from a listing, Contact → the conversation shows the listing
   (on top on a phone, on the right on desktop with your conversations on the
   left). Messages lists each conversation with its listing; unread ones have
   a red dot.
7. **More (phone):** your profile, Create a Home, Join a Home, Saved (with the
   number), My listings, Messages, Log out.
8. **Post a listing:** "How many people can live there?" is required; fill in
   a few details (e.g. Pets allowed). Once approved, the Pets allowed filter
   finds it. Your existing listings have the new details empty: edit them and
   choose how many people, or an occupants search won't show them.
9. **How It Works** and **Help** open from the header (or More).

**Sign-off:** [ ] Approved on ____  · Issues found: ____

**Not in scope:** an application workflow (Contact ≠ Application), folders in
Saved, leases and payments (outside ApptMasters), identity or phone
"verified" badges until a real verification exists.

## Sprint 13 — Look like the pictures, screen by screen

**Status:** Complete: 13a–13h approved on 2026-10-16 · Pictures: [`docs/mockups/`](mockups/)

The owner asked for the screens to match the 13 pictures more closely, one
step at a time: each step is deployed, tested by the owner and approved before
the next one starts. Owner decisions (2026-10-16): the new font and look go on
the **whole app**; people's **profile photos** show on listings and in
Messages when they've added one (letter circle otherwise); **4 new listing
details** (air conditioning, heat included, dishwasher, square feet) come with
13d, after a second OK for the database change.

| Step | What changes | Status |
|---|---|---|
| **13a — The look everywhere** | The pictures' modern font on every page; the phone's browser bar in the brand green; softer cards and borders; on phones the logo bar only on Home (other pages get their own title bar); desktop header full width with the search button and your photo and name | Approved 2026-10-16 |
| **13b — Home** | Headline, search, quick chips Filters · Price · Bedrooms · Move-in date (each opens a picker), "Already have a place?", listing tiles with "See all". (The duplicate "I'm looking for… Room to share · Whole apartment" row on the signed-out Home was removed early, at the owner's request on 2026-10-16; the "Looking for" dropdown in the search box stays.) | Approved 2026-10-16 |
| **13c — Search results** | Phone title bar (place, count, people, price, sort), chip row, All · Apartments · Rooms · Houses tabs, cards as in the picture; desktop cards with the price first and the advertiser's photo; Grid / List | Approved 2026-10-16 |
| **13d — Filters + 4 new details** | Filters screen as in the picture (price slider, Clear per section, options with icons); desktop sidebar with checkboxes; air conditioning, heat included, dishwasher, square feet on the form and as filters | Approved 2026-10-16 |
| **13e — Listing page** | Photo across the top with back, heart and share; green price; facts in 3 columns; amenities with icons; advertiser with photo | Approved 2026-10-16 |
| **13f — Saved** | Cards with View details and Message; desktop side panel and Grid / List | Approved 2026-10-16 |
| **13g — Messages** | People's photos, unread counts, the conversation without the logo bar and phone bar; desktop three panels with contact information and quick actions | Approved 2026-10-16 |
| **13h — More, How It Works, Help, Create / Join a Home** | More as in the picture (profile card, "Still looking", sections); the same look on the other pages | Approved 2026-10-16 |

**Left out from the pictures** (the app doesn't have them): star ratings,
"verified" badges other than the email confirmation, online status, calls and
video, "Schedule viewing", photos and voice in marketplace messages, folders
and saved searches, nearby places ("8 min to subway"), household chats in
marketplace Messages. The map, radius, Search history and the bell come with
12f.

### 13a — The look everywhere

**What changes**
- The font in the pictures (Inter) on every page, household pages included;
  only the lettering changes there, not the layout.
- On phones, the browser's top bar is the brand green (it was purple).
- Softer page background, lighter borders, gentle shadows on cards.
- Phones: the ApptMasters logo bar shows on Home only. Find a Home, Saved,
  Messages and More get their own title bar (back arrow where it helps, the
  page title, and its buttons), as in the pictures.
- Desktop: the header uses the full width; a search button; your photo (or
  initials), first name and ▾ for your menu. Visitors: search, Log in, Sign up.
- The phone bar: the active tab in green with a line under it.
- Quick fix at the owner's request: the signed-out Home showed "I'm looking for…
  Room to share · Whole apartment" twice; the row of buttons under the search
  box is gone, the "Looking for" dropdown in the search box stays.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass (288; this step changes only the look)
- [x] Lint: no new errors (51)
- [x] Screens compared with the pictures at phone and desktop sizes; household
      pages re-checked (Money, Cleaning, Shopping, Chat, Calendar)
- [x] CI green on GitHub (4152330)
- [x] Deployed to apptmasters.com 2026-10-16 (4152330; rebuilt without the build
      cache, which had kept the old font); live checks all 200
- [x] Quick fix deployed 2026-10-16 (0b2d0fa): "Looking for" once on the signed-out
      Home; live checks all 200

**Your test on apptmasters.com** (phone and computer)
1. Open Home, Find a Home, Saved, Messages and More: the new lettering
   everywhere, cards softer.
2. **Phone:** the browser's top bar is green. Only Home shows the
   ApptMasters logo bar; the other pages show their own title (e.g. "Saved",
   "Messages", "More"). The bottom bar shows the page you're on in green.
3. **Computer:** the header spans the window; the search button opens Find a
   Home; your photo or initials and first name open your menu.
   Signed out, Home shows "Looking for" once (the dropdown in the search box).
4. **Household pages** (Money, Cleaning, Chat, Calendar): same pages as
   before, only the lettering is new; nothing is cut off.

**Sign-off:** [x] Approved on 2026-10-16 (the owner replied "13b approved", read
as 13a approved and the go-ahead for 13b) · Issues found: none reported

### 13b — Home

**What changes** (signed in without a home; picture: `docs/mockups/home-mobile.jpg`)
- The headline and the search box as in the picture (no "Hi …" line).
- Quick buttons in a row: **Filters · Price ▾ · Bedrooms ▾ · Move-in date ▾**.
  Price, Bedrooms and Move-in date open a small picker right there; choosing
  opens Find a Home with that filter (and with what you typed in the search
  box). Filters opens the full Filters screen.
- "Already have a place?" as in the picture: a house-and-people icon, an arrow
  to How It Works, and the Create a home / Join a home buttons.
- Listing tiles as in the picture (price on the photo, title, place,
  "2 bd · 1 ba · Available Nov 1"), under **"Based on your last search"** when
  you searched earlier in this visit, otherwise **"Latest listings"**; See all
  opens that search.
- The "Have you found your new home?" card stays at the top when it's due
  (11a), a little more compact.
- Computer: the search on the left and "Already have a place?" on the right.
- Signed out: the landing page stays; its tiles get the same look.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass (288; Home only changes how it looks and links)
- [x] Lint: no new errors (51)
- [x] Screens compared with the picture at phone and desktop sizes
- [x] CI green on GitHub (fdd674b)
- [x] Deployed to apptmasters.com 2026-10-16 (fdd674b); live checks all 200

**Your test on apptmasters.com** (signed in with an account without a home,
e.g. A; phone and computer)
1. Home shows the headline, the search box and Filters · Price · Bedrooms ·
   Move-in date in a row (on a phone you can slide the row).
2. Tap **Price** and pick "$2,000" (rent up to $2,000): Find a Home opens
   with that price as a chip. Go back, tap **Bedrooms** → "2": Find a Home with 2 bedrooms.
   Tap **Move-in date**, choose a date, tap Show listings.
3. Type "Brooklyn" (or your city) in the search box, then pick a Price: the
   results are in that place and under that price.
4. After a search, come back to Home: the tiles say "Based on your last
   search" and show those listings; See all opens the same search.
5. "Already have a place?": **Create a home** and **Join a home** open their
   pages; the arrow opens How It Works.

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported

### 13c — Search results

**What changes** (pictures: `docs/mockups/search-results-mobile.jpg`,
`find-a-home-desktop.jpg`)
- **Tabs:** All · **Apartments** · **Rooms** · **Houses**, each with how many
  match (Apartments are whole places that aren't houses, including listings
  that don't say).
- **Phone, top of the page:** the place, then "6 listings · 2 people ·
  Up to $2,000", with sort. Under it, buttons with your current choices:
  Filters, the place, people, price and bedrooms. Each opens a small picker
  to change it (with "Any" to remove it). Other filters show as removable
  chips with Clear all.
- **Phone cards** as in the picture: the photo on the left with the price,
  then the title on one line, "Brooklyn, NY 11216", bedrooms · bathrooms ·
  how many people, the kind of place, when it's available, and a row of short
  details (Furnished, Wi-Fi, Laundry…).
- **Computer cards** as in the picture: the photo, then **$1,800/month**, the
  title, the place, how many people · bedrooms · bathrooms, details, and the
  advertiser's photo (or initial) and first name with "2 days ago". A **Grid /
  List** switch next to Sort by.
- **The advertiser's profile photo** shows when they've added one (nothing
  else about them: never their email).
- **"Have you found your new home?"** moves to Home only. Its email's Answer
  button and the phone notification now open Home.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 290 (new: the four tabs and their counts; the advertiser's photo
      is sent, their email never)
- [x] Lint: no new errors (51)
- [x] Screens compared with the pictures at phone and desktop sizes
- [x] CI green on GitHub (1df73b5)
- [x] Deployed to apptmasters.com 2026-10-16 (1df73b5); live checks all 200

**Your test on apptmasters.com** (phone and computer)
1. Search your city. The tabs read All · Apartments · Rooms · Houses with a
   number on each; tap Rooms: only rooms; the numbers don't change.
2. **Phone:** the top shows the place and "N listings". Tap the **price**
   button → pick $2,000: the results update and the button says "Up to
   $2,000"; tap it again → **Any price**. Do the same with **people** and
   **bedrooms**.
3. **Phone cards:** photo on the left with the price; the title fits on one
   line; the facts and a row of details below; the heart saves.
4. **Computer:** cards start with "$…/month"; the advertiser's photo or
   initial and first name at the bottom with how long ago it was posted.
   Switch to **List**, then back to **Grid**.
5. Signed in as an account the question is due for (A or B): the "Have you
   found your new home?" card is on **Home**, no longer on Find a Home.

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported

### 13d — Filters + 4 new listing details

**What changes** (pictures: `docs/mockups/filters-mobile.jpg`, the left panel of
`find-a-home-desktop.jpg`)
- **Phone Filters screen** as in the picture: it slides up as a sheet with a
  handle; every section has its icon and its own **Clear**; Reset all at the
  top; "Show N listings" stays at the bottom.
  - **Property type: All · Apartment · Room · House** (the same as the tabs;
    for Room you can then pick a private or shared room).
  - **Price range: a slider with two handles**, the amounts above them, and
    Min / Max boxes to type an exact amount ($5,000+ means no top limit).
  - Bedrooms, Number of occupants, Bathrooms, Move-in date, as in the picture.
  - **Additional options with an icon each**: Furnished, Pet friendly,
    Parking, Laundry, Wi-Fi, Air conditioning, Elevator, Heat included,
    Dishwasher, Utilities included, Private bathroom, Accessible.
  - **Size**: Any, 500+, 750+, 1,000+, 1,500+ square feet.
  - Then the filters from your document that the picture doesn't show: lease,
    smoking, fees, how recently it was listed.
- **Computer filter panel** as in the picture: property type and the options
  as tick boxes, the price slider with Min / Max, and **Apply filters**.
- **4 new listing details** on the listing form: air conditioning, heat
  included, dishwasher (in "What's included") and the size in square feet.
  They're filters right away; the listing page shows the size from 13e.
- **Database change:** 4 empty columns on listings (nothing existing changes).
  I ask your OK before applying it on the live site.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 292 (new: the 4 details are saved and found by their filters; a
      size that makes no sense is refused)
- [x] Lint: no new errors (51)
- [x] Screens compared with the pictures at phone and desktop sizes
- [x] CI green on GitHub (28eec7e)
- [x] Deployed to apptmasters.com 2026-10-16 (28eec7e) with
      `prisma/manual-sql/2026-10-16-sprint-13d-listing-extras.sql` (owner's OK);
      live checks all 200

**Your test on apptmasters.com** (phone and computer)
1. **Phone:** in Find a Home tap **Filters**: the sheet slides up with a
   handle. Drag the two price handles: the amounts above them change; type a
   Max instead. Choose Property type **Room**, then **Private room**. Tap
   **Show N listings**: the results match.
2. Open Filters again: each section you set has **Clear**; **Reset all** clears
   everything.
3. **Computer:** the panel on the left has tick boxes for the property type
   and the options, the price slider, and **Apply filters** at the bottom.
4. **Your listing:** edit it, tick **Air conditioning** and **Dishwasher**,
   enter a size (e.g. 850 square feet), save. Once it's live again, the
   **Air conditioning** option and **Size 750+** both find it.

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported

### 13e — Listing page

**What changes** (picture: `docs/mockups/listing-details-mobile.jpg`)
- **Phone:** the photo across the top with round back, heart and share
  buttons and "1 / N", the thumbnails under it; the title, the **price in
  green**, the place.
- **Facts in 3 columns** with lines between them: bedrooms · bathrooms · how
  many people / the kind of place · **size in square feet** (from 13d) · when
  it's available.
- **Amenities** with an icon each (Wi-Fi, Laundry, Heat, Elevator…); "See
  all" when there are more than 8.
- The description with "Show more"; Lease and fees; the roommate they're
  looking for (rooms).
- **Neighborhood** as a card: the neighborhood and city, and "the exact
  address is shared by the advertiser in Messages" (the map comes with 12f).
- **The advertiser** with their **profile photo** (or initial), "Email
  confirmed" and "Member since".
- Save and Contact stay at the bottom on phones.
- **Computer:** the photos on the left with everything under them; on the
  right a card that stays in view: the price, the kind of place, bedrooms ·
  bathrooms · people, Save and Contact, then the advertiser.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 292 (extended: the listing sends the advertiser's photo, never their
      email)
- [x] Lint: no new errors (51)
- [x] Screens compared with the picture at phone and desktop sizes
- [x] CI green on GitHub (667bf78)
- [x] Deployed to apptmasters.com 2026-10-16 (667bf78); live checks all 200

**Your test on apptmasters.com** (phone and computer)
1. Open a listing on the phone: the photo is at the very top with back,
   heart and share; tap a thumbnail to change the photo.
2. Under the title and the green price: the facts in 3 columns. Your listing
   (with the size you entered in 13d) shows "850 sq ft".
3. **Amenities** show with icons; the neighborhood card says the exact address
   is shared in Messages.
4. The advertiser card shows their photo if they added one (add a profile
   photo to your account to see yours), "Email confirmed" and "Member since".
5. **Computer:** photos on the left, and on the right a card with the price,
   Save and Contact that stays in view as you scroll.

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported

### 13f — Saved

**What changes** (pictures: `docs/mockups/saved-mobile.jpg`, `saved-desktop.jpg`)
- **Phone:** "Saved · Your saved listings (N)" with a **search** button (opens
  the search box) and a **"…"** button (sort: recently saved, price low to
  high, high to low). Tabs **All · Apartments · Rooms · Houses** with counts,
  like Find a Home.
- **Phone cards** as in the picture: the photo with the red heart and the
  price, the title with a **"…" menu** (View details, Share, Remove from
  Saved), the place, the facts, when it's available, and **View details** /
  **Message** buttons.
- **Computer:** on the left, **All saved · Apartments · Rooms · Houses** with
  an icon and a count each. On the right, "Saved listings", the search box,
  Sort by and **Grid / List**. Grid cards: "**N photos**" on the photo, the
  price with the "…" menu, and at the bottom the advertiser and "**Saved 2
  days ago**".
- A listing that's no longer available stays, labeled, with **Remove from
  Saved** (as before).
- Left out (the app doesn't have them): saved searches, folders.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 292 (no new ones: the page only changes how it looks)
- [x] Lint: no new errors (51)
- [x] Screens compared with the pictures at phone and desktop sizes
- [x] CI green on GitHub (f397ec9)
- [x] Deployed to apptmasters.com 2026-10-16 (f397ec9); live checks all 200

**Your test on apptmasters.com** (save 2 or 3 listings first; phone and computer)
1. **Phone:** Saved shows "Your saved listings (N)". Tap the **search**
   button and type part of a title: only matching cards stay. Tap **"…"**
   and sort by price.
2. Tabs All · Apartments · Rooms · Houses show how many each; tap one.
3. On a card, tap **"…"**: **Share** copies or shares the link; **Remove from
   Saved** takes the card away. **View details** and **Message** open the
   listing and the conversation.
4. **Computer:** the left panel switches between the kinds; **Grid / List**
   switches the layout; grid cards show "N photos", the advertiser and "Saved
   … ago".

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported

### 13g — Messages

**What changes** (pictures: `docs/mockups/messages-mobile.jpg`,
`conversation-mobile.jpg`, `messages-desktop.jpg`)
- **Messages (phone):** a **search** button that filters your conversations;
  tabs **All** (with the number of unread conversations in red) · Places I
  asked about · My listings. Each conversation as in the picture: the
  **person's photo** (or initial), their name and role, the time, a **red
  count of unread messages**, the last message on 2 lines, and the listing
  with its photo, price, bedrooms and city.
- **A conversation (phone):** **no logo bar and no bottom bar**, so it uses
  the whole screen. At the top: back, the person's photo, name and role. Then
  the listing (photo, title, green price, facts, city, **View listing**).
  Messages with the day ("Today"), the person's photo next to theirs, the
  time and ✓✓ when read. The message box across the bottom with a round
  green send button.
- **Computer:** three panels across the window: your conversations with a
  search box and the tabs; the chat; and on the right the listing (photo,
  price, title, place, facts, **View full listing**), **Contact information**
  (photo, role, member since, Email confirmed) and **Quick actions**: Save
  listing, Share listing, Report this listing.
- Left out (the app doesn't have them): online status, calls and video,
  photos and voice in these messages, "Schedule viewing", "New message"
  (a conversation always starts from a listing), household chats here.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 293 (new: Messages sends each person's photo and the number of
      unread messages, never an email)
- [x] Lint: no new errors (51)
- [x] Screens compared with the pictures at phone and desktop sizes
- [x] CI green on GitHub (1c99116)
- [x] Deployed to apptmasters.com 2026-10-16 (1c99116); live checks all 200 (now
      including the Messages list)

**Your test on apptmasters.com** (two accounts, e.g. A and B, and a listing
of yours)
1. As A, Contact your listing and send two messages. As yourself (the
   advertiser), open **Messages**: the conversation shows A's photo (or
   initial), "Interested in your listing", a **red 2**, and the listing; the
   All tab shows how many conversations are unread.
2. Tap **search** and type part of a name or a listing title: only matching
   conversations stay.
3. **Phone:** open the conversation: no logo bar and no bottom bar; the
   listing is on top with **View listing**; reply. Back on A's phone, the
   reply arrives, and A's messages show ✓✓ once read.
4. **Computer:** Messages opens three panels; on the right, **Contact
   information** and **Quick actions**: Save listing saves it, Share listing
   copies the link, Report this listing opens the report form.

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported

### 13h — More, How It Works, Help, Create / Join a Home

**What changes** (pictures: `docs/mockups/more-mobile.jpg`,
`create-home-mobile.jpg`, `join-home-mobile.jpg`)
- **More:** your profile card with your photo (or initials) and a **camera
  badge** that opens your profile to change the photo; "Still looking for a
  place?" with the picture's **house-and-magnifier drawing**; the Housing,
  Search & listings, Messages and Account sections as in the picture.
- **Join a Home:** the first screen gets a **drawing of a home with
  roommates** like the picture, instead of the icons.
- **Create a Home, Join a Home, How It Works, Help:** on phones a white page
  like the rest of Find a Home; the same cards and spacing as the other
  screens. The steps themselves don't change.
- Left out (the app doesn't have them): Search history (comes with 12f),
  "Request to join" a home you search for, the extra Create a Home settings
  (apartment type, bedrooms, residents, expense and task switches) and
  sharing a phone number.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 293 (no new ones: these pages only change how they look)
- [x] Lint: no new errors (51)
- [x] Screens compared with the pictures at phone and desktop sizes
- [x] CI green on GitHub (d73848e)
- [x] Deployed to apptmasters.com 2026-10-16 (d73848e); live checks all 200

**Your test on apptmasters.com** (phone; signed in without a home)
1. **More:** your photo (or initials) has a small camera badge: tapping it
   opens your profile, where you can add a photo. "Still looking for a
   place?" shows the house-and-magnifier drawing and opens Find a Home.
2. **Join a Home:** the first screen shows the drawing of a home with
   roommates; "Join with an invite code" still works as before.
3. **Create a Home**, **How It Works** and **Help** look like the rest of the
   app (white page on phones, same cards).

**Sign-off:** [x] Approved on 2026-10-16 · Issues found: none reported. **Sprint 13 complete.**
The owner chose not to do 12f for now and to move on to the pre-launch items.

## Pre-launch — before the public launch

**Status:** P1 being prepared (planned 2026-10-16, after Sprint 13; 12f waits at
the owner's request) · List: [`ROADMAP.md`](ROADMAP.md) "Before public launch"

One step at a time, like the sprints. Several steps need the owner in the AWS
console or a password manager; every change to the server's configuration
(scheduled jobs, settings) is asked first.

| Step | What | Who | Status |
|---|---|---|---|
| **P1 — Nightly backups** | Database and uploaded files every night: 3 nights kept on the server, 30 days in a private encrypted S3 bucket; an email to the site admins if a night fails; a restore tested ([`BACKUPS.md`](BACKUPS.md)) | Owner: one paste in AWS CloudShell. Developer: the rest | Being prepared |
| **P2 — AWS budget alert** | An email to the owner when the month's AWS bill goes over a set amount | Owner: one paste in CloudShell | Not started |
| **P3 — Settings in a password manager** | The owner keeps a copy of the server's `.env.local` (passwords and keys) in a password manager, so a lost server can be rebuilt | Owner, with instructions | Not started |
| **P4 — Changing your password signs out your other devices** | Today an old sign-in on another phone keeps working after a password change or reset | Developer (small database change, owner's OK first) | Not started |
| **P5 — Security review before launch** | A fresh pass over every page and API: who can see and change what | Developer | Not started |

### P1 — Nightly backups

**What changes**
- Every night at 3:30 am New York time, the server saves the **database** and
  the **uploaded files** (photos, receipts, voice messages).
- It keeps the **last 3 nights on the server** and copies each night to a
  **private, encrypted storage bucket in your AWS account**, where copies are
  deleted after **30 days**. The server can add backups there but not delete
  them.
- If a night fails, **you get an email** saying which step failed.
- The live checks show the last backup.
- A **restore check** proves a backup can really be restored: it restores
  into a temporary database, compares the numbers with the live site and
  deletes the copy. It changes nothing live.
- Cost: about $0.03 a month. Passwords and keys (`.env.local`) are not in
  the backups (that's P3).

**What the owner does once:** paste the block from
[`BACKUPS.md`](BACKUPS.md) ("One-time setup in AWS") into AWS CloudShell and
send the developer the bucket name it prints.

**Automatic checks (developer)**
- [x] Type check passes
- [x] Tests pass: 296 (new: a failed night emails the site admins, never anyone
      else; only the server with the cron secret can report)
- [x] Lint: no new errors (51)
- [ ] CI green on GitHub
- [ ] Deployed to apptmasters.com
- [ ] Owner's OK: the nightly job on the server and the bucket name in its
      settings
- [ ] First backup made by hand and copied to S3; restore check passed
- [ ] The first nightly run (next morning) logged OK

**Your test**
1. In the AWS console, open **S3** and the bucket `apptmasters-backups-…`: a
   folder with today's date holds `db.dump`, `uploads.tar.gz` and
   `SHA256SUMS`. The next mornings, one more folder each day.
2. The bucket says "Block all public access: On" and encryption is on.
3. I send you the restore check's result: the table counts match.

**Sign-off:** [ ] Approved on ____  · Issues found: ____

