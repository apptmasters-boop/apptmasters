# Apartment Masters — Product & Functional Logic

*Developer Implementation Blueprint. Provided by the product owner on
2026-10-07; this file is the source of truth for product behaviour. Sprints in
`README.md` and `docs/BUILD_CHECKLIST.md` refer to its section numbers.*

> **Core product rule**
> Apartment Masters must be workflow-driven, not page-driven. The user performs
> an action once; the platform automatically updates every downstream module
> that already has enough information to react.

**Scope:** Marketplace → Home Setup → Household → Money → Shopping → Maintenance → Calendar → Chat → Notifications

## 1. Product Vision & Architecture

Apartment Masters is one product with two connected phases:

**FIND A HOME → CREATE / JOIN MY HOME → LIVE & MANAGE TOGETHER**

- **Find a Home:** browse, search, view listings, save, contact and follow the housing journey.
- **My Home:** manage the household, money, rotations, shopping, maintenance, communication and shared events.
- The transition is user-confirmed. Apartment Masters does not infer that a legal lease was signed outside the platform.

> **UX principle**
> Do not expose every feature as a card or menu item. Show the information or
> action that matters now, and keep the underlying feature structure secondary.

## 2. User States, Roles & Context

### 2.1 User states

**VISITOR → HOME SEEKER → FOUND A HOME → HOME MEMBER**

- **Visitor:** public browsing without a household.
- **Home Seeker:** registered user actively looking for housing.
- **Found a Home:** user self-reports that a place was found and may start Home Setup.
- **Home Member:** user has created or joined a household.

### 2.2 Roles and permissions

Role and context must be separated. One account can hold several permissions at the same time:

- Platform User
- Household Member
- Household Admin
- Rent Payer
- Listing Owner / Host
- Landlord
- Platform Admin / Super Admin

A regular Home Member must never receive the Super Admin dashboard simply because the same account can hold administrative permissions.

## 3. Marketplace & Home-Seeker Journey

### 3.1 Public flow

**Landing → Search / Listings → Listing Details → Sign In / Sign Up when needed**

- Browsing and listing details remain public.
- Contact/application actions can require authentication.
- Landing, Listings, Details, Login and Sign Up must use one consistent design system.

### 3.2 Housing journey tracking

The platform may record signals such as searches, listing views, saves and owner contacts. These signals help decide when to ask about the user's progress; they do not prove tenancy.

**Looking → Exploring → Contacting → In Discussion → Found a Place (self-reported)**

### 3.3 Follow-up prompt

After a reasonable time/activity threshold, use in-app, push or email follow-up:

“Have you found your new home?”

- “I’m still looking” → keep seeker experience.
- “Yes, I found a place” → start Home Setup.

Use cooldown rules to avoid repeated prompts and notification fatigue.

## 4. Home Setup & Household Membership

**I found a place → Found through Apartment Masters? → Select/enter home → Move-in date → Create My Home → Invite roommates**

- A user can create a Home even if the apartment was found outside Apartment Masters.
- A roommate can Join a Home through an invitation.
- Having found housing and choosing to use My Home are separate decisions.
- Move-in date can be used to delay rent/household automations until they are relevant.

## 5. Home-Member Navigation

**HOME | HOUSEHOLD | MONEY | CHAT | MORE**

- These five primary destinations do not use a back arrow.
- Child/detail pages use a back arrow to their parent context.
- Chat shows the unread count as a badge in bottom navigation. Do not duplicate ordinary unread-message cards on Home.
- More is a secondary menu, not another dashboard.

## 6. Home Dashboard — Priority Feed

Home answers one question: “What needs my attention now?” It is not a grid of product features.

### 6.1 Suggested priority model

| Priority | Examples | Home behavior |
|---|---|---|
| P1 Critical | Urgent maintenance / safety issue | Prominent alert |
| P2 Financial | Rent overdue / due soon | High visibility |
| P3 Personal duty | My cleaning or shopping turn | Actionable card |
| P4 Scheduled | Repair appointment / household event | Upcoming card |
| P5 Informational | General updates | Low emphasis / activity |

- A normal “Hi” message stays in Chat and is represented by the Chat badge.
- If a household responsibility belongs to someone else, Home may show it with lower emphasis or not at all.

## 7. Household

Household organizes day-to-day responsibilities. It should show what is happening first, then provide compact access to modules.

- Cleaning
- Shopping / Groceries
- Inventory
- Optional Chores
- Rooms

Avoid turning these modules into five large colored menu cards. Prefer a “This week / Today” activity view plus compact navigation.

## 8. Cleaning Rotation

Cleaning is primarily a whole-home rotation, not mandatory assignment of individual rooms/tasks.

**Elhadj → AD → Lamarana → Elhadj → …**

### 8.1 Configuration

- Rotation name
- Frequency and cleaning day
- Members and order
- Reminder rules
- Away/traveling status

### 8.2 Runtime behavior

**Current turn → Reminder → Mark as cleaned → Save history → Advance rotation → Schedule next turn**

- A member marked away/traveling can be skipped according to household rules.
- Recommended views: Rotation | Schedule | History.
- Advanced actions such as edit/delete rotation belong behind settings/permissions, not as large primary buttons.
- If a member cannot clean, use friendly wording such as “Can’t clean this week?” / “Request to skip this turn.”

## 9. Optional Chores

Chores are separate from the Cleaning Rotation and are optional. They cover small responsibilities such as taking out trash, watering plants or organizing a room. A household can use Cleaning without using Chores.

## 10. Shopping, Grocery & Inventory — One Connected Workflow

> **Business rule**
> Inventory, Grocery List and Expenses must not behave as three isolated
> products. Shopping is one workflow. The user should never have to recreate a
> grocery purchase manually in Add Expense.

### 10.1 Shopping rotation

**Elhadj → Sarah → AD → Elhadj → …**

- The current shopper is known by the system.
- After a completed shopping trip, advance the rotation according to household rules.

### 10.2 Optional Home Check

Home Check is helpful preparation, but it is never mandatory.

**Your shopping turn → Start Home Check OR Skip for now → Shopping List**

- Start Home Check: review Inventory and add missing/low items.
- Skip for now: go directly to the existing shared Shopping List.
- The shopper can begin shopping even if Home Check was never performed.

### 10.3 Inventory → Shopping List

- Inventory represents household stock. Example statuses: OK, Low, Out.
- Low/Out items can be added to the Shopping List with one action.
- No duplicate typing between Inventory and Grocery.
- Automatic stock depletion should not be assumed unless the product has reliable data; suggestions are safer than fake certainty.

### 10.4 Shared Shopping List

All authorized household members can add items to the shared list. The active shopper sees live changes.

- If Sarah adds Tomatoes while Elhadj is shopping, Tomatoes is added to the current list.
- Elhadj specifically receives a personalized notification because he is the active shopper.
- Other roommates do not need the same shopper-specific alert.
- Batch rapid additions to reduce notification spam, e.g. “3 new items were added: Tomatoes, Milk, Rice.”

### 10.5 Shopping session states

**PREPARING → SHOPPING → LEFT_STORE → COMPLETED**

- **PREPARING:** list can be reviewed and Home Check may be performed or skipped.
- **SHOPPING:** shopper indicates “I’m at the store”; new roommate additions join the active list and notify the shopper.
- **LEFT_STORE:** shopper indicates “I’ve left the store”; late additions should not silently join the current trip.
- **COMPLETED:** declared total, receipt and purchased items are confirmed; downstream financial automation runs.

### 10.6 Late item behavior

If a roommate adds an item after LEFT_STORE:

- Show: “Elhadj has already left the store. This item will not be part of the current trip.”
- Offer: “Add to next shopping list.”
- Optionally notify the shopper of the late request, but never imply that returning to the store is required.

### 10.7 Shopping completion & receipt

Apartment Masters does not process the store payment. Therefore the total is entered manually by the shopper.

**Purchased items → Enter total spent manually → Upload receipt → Review split → Confirm & Finish**

- Example declared total: $84.60.
- Receipt is supporting evidence uploaded by the shopper.
- For MVP, do not claim the receipt automatically verifies the typed amount unless receipt-reading/OCR validation is actually implemented.
- Use a review screen before creating balances to catch typing mistakes.

Example review:

- Total declared: $84.60
- Receipt: uploaded
- Paid by: Elhadj
- Participants: Elhadj, Sarah, AD
- Split: $28.20 each

### 10.8 Shopping completion automation

**Confirm shopping → Save trip + receipt → Create grocery expense → Split → Update balances → Save activity → Advance rotation**

- Do not send the shopper to Add Expense after completion.
- If household split rules allow exclusions/custom shares, the review step must support them before confirmation.

## 11. Money — Unified Financial Source of Truth

Use Money as the main user-facing financial area. Rent, grocery expenses, manual shared expenses, reimbursements and shared fund activity must feed one balance engine.

**Overview | Activity | Balances**

### 11.1 Overview

- How much I owe
- How much is owed to me
- What is due next
- Compact entry points to Rent, Shared Expenses and Shared Fund

### 11.2 Unified balance engine

**Rent debt + Grocery debt + Shared expenses ± Adjustments − Payments = Current balance**

- Money must never show “All settled up” while Rent or another module still contains an unpaid debt.
- Every financial source must create standardized ledger/balance entries.

## 12. Rent

Rent must distinguish payment to the landlord from reimbursement among roommates.

### 12.1 Two separate financial facts

- **Landlord Payment:** was the full apartment rent paid to the landlord?
- **Household Collection:** did each roommate reimburse the designated Rent Payer?

Example: total rent $1,950; 3 members; $650 each. The landlord can be fully paid while two roommates still owe the Rent Payer $650 each.

### 12.2 Monthly summary

- Total rent
- Landlord status
- Collected / expected amount
- Per-member status
- Outstanding reimbursement
- Send reminder action where appropriate

If Lamarana and AD each owe $650 for September and October, Money must reflect $1,300 owed by each, not $0.

### 12.3 History

- October 2026 — $1,300 outstanding
- September 2026 — $1,300 outstanding
- August 2026 — Paid

Open a month for details instead of rendering a very large repeated card for every month.

## 13. Expenses, Payments & Settlements

### 13.1 Expense creation

- **Automatic:** completed Shopping trip creates Grocery Expense.
- **Manual:** Add Expense remains available for expenses outside a dedicated workflow, e.g. internet bill or household purchase.

### 13.2 Settlement

**Member pays another member → Record payment → Reduce payer debt → Reduce receiver receivable → Save activity**

- Preserve transaction history for transparency.
- Do not delete the original expense when settled; change balance state through payment entries.

## 14. Maintenance — Household ↔ Landlord Workflow

Maintenance is a communication and accountability workflow between residents and the landlord/manager.

**Report → Landlord notified → Acknowledge → Schedule → In progress → Complete → Resident feedback → Resolve**

### 14.1 Resident report

- Title / issue type
- Description
- Room/location
- Priority
- Photo/video attachment where supported

### 14.2 Landlord portal

- Receive a new maintenance request notification.
- Acknowledge the request.
- Schedule a repair appointment / service window.
- Update status and notes.

### 14.3 Recommended statuses

**REPORTED → ACKNOWLEDGED → SCHEDULED → IN PROGRESS → COMPLETED → RESOLVED**

### 14.4 Appointment automation

**Landlord schedules repair → Maintenance updated → Calendar event created → Household notified/email → Home priority feed updated**

### 14.5 Resident confirmation

After Completed, ask:

- Yes, resolved → RESOLVED.
- No, still having problems → reopen/return to landlord with resident feedback.

This feedback closes the loop and prevents “completed” from automatically meaning “successfully fixed.”

## 15. Calendar — Aggregated Household Timeline

Calendar should aggregate events generated by other modules instead of forcing duplicate event entry.

- Cleaning rotation dates
- Shopping rotation dates
- Rent due dates
- Maintenance appointments
- Household-created events

Example: Oct 6 Rent due; Oct 7 Plumber 2–4 PM; Oct 11 Cleaning turn; Oct 12 Shopping turn.

## 16. Chat & Communication

- Household Chat
- Direct Messages
- Announcements

Use the bottom-navigation badge for unread messages. Ordinary unread messages should not consume a Home dashboard card.

Marketplace/listing-specific conversations before Home membership remain contextually separate from household chat.

## 17. More

More is the secondary navigation area. Recommended grouping:

| Group | Items |
|---|---|
| Home Management | Maintenance; Household Issues; Calendar |
| Insights | Activity; Stats |
| Marketplace | Search Listings; My Listings |
| Account | Profile; Notifications; Settings; Help |

Child pages opened from More use a back arrow to More.

## 18. Household Issues

Prefer a constructive user-facing label such as Household Issues over Disputes when appropriate.

**Issue created → Open → Discussion → Proposed resolution → Resolved**

Examples: noise concern, cleaning disagreement, shared-expense disagreement, roommate concern.

## 19. Insights / Stats

Insights are secondary and must aggregate existing source data rather than create independent calculations.

- Money insights: household spending, rent history, categories.
- Household insights: cleaning completion, shopping rotations, optional chores.
- Stats must use the same Money ledger/balance engine as the rest of the product.

## 20. Notification Engine

Use one notification service with event types and channel preferences.

- `rent_due` / `rent_overdue`
- `cleaning_turn`
- `shopping_turn`
- `shopping_item_added` — personalized to the active shopper during SHOPPING
- `maintenance_reported` / `maintenance_scheduled` / `maintenance_updated`
- `payment_received`
- `household_invitation`

Channels: in-app, push, email. Use importance, user preferences and anti-spam grouping/cooldowns.

## 21. Cross-Module Event Logic

The developer should treat important actions as domain events so modules can react without duplicate user entry.

| User action / event | Automatic downstream updates | Must NOT require |
|---|---|---|
| Shopping completed | Receipt saved; grocery expense; split; balances; activity; rotation advance | Manual Add Expense |
| Rent share becomes due | Money balance; reminder eligibility; Home priority | Separate finance entry |
| Payment recorded | Balances updated; activity; receipt/payment history | Editing original expense |
| Maintenance scheduled | Maintenance status; Calendar; notifications; Home upcoming item | Manual calendar duplication |
| Cleaning completed | History; rotation advance; next date/reminder | Manual reassignment |
| Inventory item added to list | Shared Shopping List updated | Re-entering grocery item |

## 22. Suggested Core Domain Entities

Exact schema is implementation-dependent, but the product logic requires clear domain ownership. Suggested concepts:

- User
- Household / Home
- HouseholdMembership (role, status, start/end dates)
- HouseholdInvitation
- Listing and ListingConversation
- HousingJourney / user-reported outcome
- Rotation (type: cleaning/shopping), RotationMember, RotationTurn
- InventoryItem
- ShoppingList / ShoppingItem / ShoppingSession
- Expense / ExpenseShare / Payment / LedgerEntry
- RentPeriod / RentShare / LandlordPayment
- MaintenanceRequest / MaintenanceAppointment / MaintenanceFeedback
- CalendarEvent
- Notification
- HouseholdIssue

Avoid duplicating balances as unrelated fields across Rent, Finance and Expense. Prefer a single ledger/balance calculation layer.

## 23. Global UI/UX Rules

- Primary pages (Home, Household, Money, Chat, More) have no back arrow.
- Secondary/detail pages use contextual back navigation.
- Use one Apartment Masters branding/design system across marketplace and My Home.
- Avoid aggressive multi-color card grids. Use restrained accents, whitespace and clear hierarchy.
- Prefer actionable summaries over feature cards.
- Use progressive disclosure: show detail only when the user opens the relevant workflow.
- Do not show admin metrics such as total users/apartments to regular Home Members.
- Avoid duplicate indicators: unread chat count belongs primarily on Chat badge.
- Make system state explicit: due, overdue, scheduled, shopping, left store, completed, resolved.
- Always explain what happens next after a major action.

## 24. Recommended Execution Order

| Sprint | Focus |
|---|---|
| 1 — Foundation | User states, household membership, roles/permissions, shared design/navigation. |
| 2 — Home | Priority feed and regular Home Member dashboard. |
| 3 — Cleaning | Adapt existing rotation logic to new UX; schedule/history/travel behavior. |
| 4 — Shopping | Unify shopping rotation, optional Home Check, shared list, live shopper notifications and session states. |
| 5 — Money Engine | Unify Rent, grocery/manual expenses, ledger, balances and payments. |
| 6 — Shopping → Money | Complete Shopping creates expense, receipt link, split, balances and rotation advance. |
| 7 — Rent | Landlord payment vs roommate reimbursement; outstanding summaries and reminders. |
| 8 — Maintenance | Resident ↔ landlord workflow, appointment, statuses, confirmation and feedback. |
| 9 — Calendar + Notifications | Aggregate generated events and centralize push/in-app/email rules. |
| 10 — More / Issues / Insights | Secondary navigation and aggregation views. |
| 11 — Marketplace → My Home | Housing follow-up prompts and Create/Join Home transition. |

## 25. Key Acceptance Criteria

- A Home Check can always be skipped without blocking Shopping.
- During SHOPPING, a roommate-added item appears on the active list and the active shopper receives a personalized notification.
- After LEFT_STORE, late additions are routed to the next list rather than silently added to the current trip.
- Shopping total is manually entered; receipt is uploaded as supporting evidence; a review step occurs before confirmation.
- Completing Shopping automatically creates the grocery expense and updates Money; no manual Add Expense is required.
- Rent reimbursements appear in the same Money balance as grocery/shared expenses.
- Money never reports zero/all-settled while an unpaid Rent share exists.
- A landlord-scheduled maintenance appointment automatically appears in Calendar and notifies the household.
- Maintenance cannot be considered fully resolved until the resident confirmation/feedback step is handled according to workflow.
- Cleaning completion advances the rotation and records history automatically.
- Unread chat is represented by the Chat badge without redundant ordinary-message cards on Home.

## 26. Product North Star

> **North Star**
> Apartment Masters should feel like one intelligent household assistant, not
> a collection of disconnected pages. Every module should reuse information the
> platform already knows, reduce repetitive entry, and guide the user naturally
> to the next action.

**One action → automatic downstream updates → clear next step**
