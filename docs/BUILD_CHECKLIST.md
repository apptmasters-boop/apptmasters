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

**Status:** 8a approved · 8b building · Spec: `PRODUCT_LOGIC.md` §14

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

**Status:** Building

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
- [ ] Deployed to apptmasters.com (waiting: the server stopped accepting SSH
      from the developer PC on 2026-10-15; database file
      `prisma/manual-sql/2026-10-15-sprint-8b-confirm-fix.sql` ready)

**Your test on apptmasters.com** (the reporter's account and an admin's)
1. Take a request to **Completed** (as in 8a).
2. On the reporter's account, Home shows "Is it fixed? *title*". On the
   request, tap **No, still a problem**, write what's still wrong, send. It's
   back to **Reported**, and the timeline shows "Still a problem" with the
   note. The admin's Home shows "Tell the landlord: …" again.
3. Move it to **Completed** again (admin), then on the reporter's account
   tap **Yes, it's fixed**. It moves to **Resolved**.
4. A roommate who didn't report it isn't asked.

**Sign-off:** [ ] Approved on ____  · Issues found: ____

---

## Sprint 9 — Calendar + Notifications

**Status:** 9a building on the developer PC (owner, 2026-10-15: keep working
while away; 8b is deployed and tested first, then 9a) · Spec:
`PRODUCT_LOGIC.md` §15, §20, §21

### 9a — A calendar that builds itself

**Status:** Building

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
- [ ] Deployed to apptmasters.com (after 8b is approved)

**Your test on apptmasters.com**
1. More → **Calendar**. This month shows the rent due day, upcoming cleaning
   turns, who's away and the repair visits, without anyone adding them.
2. Tap a cleaning turn: it opens Cleaning. Tap rent: it opens Rent.
3. These entries have no Edit or Delete. Household events you add still do.

**Sign-off:** [ ] Approved on ____  · Issues found: ____

### 9b — One notification service

**Status:** Not started (test steps written when it starts)

- Notification settings per category (Rent, Money, Cleaning, Shopping,
  Maintenance, Household): choose push and email; in-app always stays on.
- Quick repeats are grouped into one notification instead of many (§20).

---

## Later sprints (outline; detailed test steps are written when each starts)

| Sprint | Planned slices | Status |
|---|---|---|
| 10 — More / Issues / Insights | 10a Household Issues (was Disputes) · 10b insights from the ledger | Not started |
| 11 — Marketplace → My Home | 11a "Have you found your new home?" · 11b Create / Join Home flow | Not started |
