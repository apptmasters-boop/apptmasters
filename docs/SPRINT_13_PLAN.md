# Sprint 13 plan — make the app look like the owner's pictures, one step at a time

Approved by the owner on 2026-10-16. Status and test steps per step:
[`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md) ("Sprint 13"). Where we stopped:
[`HANDOFF.md`](HANDOFF.md).

## Context

Sprint 12a–12e is live, but the owner wants the screens to match their 13
pictures (`docs/mockups/*.jpg`) more closely: "work on the front end to match
those pictures… steps to test after each step and approve the next one."

I compared every picture with the current screens. The biggest gaps are shared
by every screen:
- **Font:** `src/app/globals.css` sets `body { font-family: Arial }`. Geist is
  loaded in `src/app/layout.tsx` but never used, so the app looks plain next
  to the pictures' modern font.
- **Phone browser bar:** `themeColor` is indigo `#4f46e5`, not the brand green.
- **Phone page headers:** in the pictures, the logo bar appears only on Home.
  Other pages have their own title bar:
  - Results: back arrow, place, "N listings · 2 people · $500–$5,000+", sort.
  - Saved and Messages: big title, search icon, "…".
  - Listing: the photo fills the top, with back, heart and share on it.
  - Conversation: the person and the listing at the top, the message box at
    the bottom, and no bottom bar.

  Today every page shows the logo bar, and the conversation header gets
  partly hidden under it.
- **Density:** the pictures fit facts on one line ("2 bd · 1 ba · Max 4 ·
  Apartment") with chips in a row. Ours wrap onto 3–6 lines.
- **Desktop:** the pictures use the full width with three panels. Ours is
  boxed in the middle. Desktop cards lead with the price, then the title, the
  advertiser with a photo, and "2 days ago".

**Owner decisions (2026-10-16):**
- New font and look on the **whole app**, household pages included.
- **Show profile photos** (advertiser, conversation partner) when the person
  added one; keep the letter circle otherwise.
- **Add 4 listing details:** air conditioning, heat included, dishwasher,
  square feet. This is a small SQL change, and I'll ask the owner's OK again
  before applying it on the live site.

**Left out** (the app doesn't have them; the owner said not to count them):
- star ratings and "verified" badges other than "Email confirmed";
- online status, calls and video;
- "Schedule viewing";
- photos and voice in marketplace messages;
- folders and saved searches;
- nearby places ("8 min to subway");
- the Household and Archived tabs in marketplace Messages, and "New message".

**Waiting for 12f:** map, radius, Search history and the bell. Until then, the
map icon and the bell aren't shown.

## How every step runs (the owner's rule)

1. Write the step and its test in `docs/BUILD_CHECKLIST.md` (new "Sprint 13"
   section).
2. Build.
3. Run the screenshot script ([`scripts/dev/screenshots/`](../scripts/dev/screenshots/README.md),
   local app on :3100 against `apptmasters_test`) at **390 px phone** and
   **1536 px desktop**. Put each screen beside its picture and fix differences before
   shipping.
4. Run `npm run typecheck`, `npx vitest run` and `npm run lint:ratchet`, then
   push and wait for CI.
5. Deploy: pull, then SQL only in 13d after the owner's OK, then
   `prisma generate`, the background build and `verify-live.sh`.
6. Send the owner the test steps, wait for **"13x approved"**, then start the
   next step.

The live site has only 3 listings with few details, so screens will look
emptier than the pictures. The 13d test asks the owner to fill in their
listing.

## The steps

### 13a — The look everywhere (font, colors, headers, phone bar)

Build:
- **Font:** `layout.tsx` loads Inter, the closest match to the pictures, with
  `next/font/google`. `globals.css` uses it for `body` instead of Arial.
- `themeColor` becomes brand green `#1d5c4b`.
- **Look:** a softer page background, lighter borders and gentle shadows on
  cards, a consistent 12–16 px corner radius, text sizes and weights as in the
  pictures (titles bold and tight, secondary text gray).
- **New `PageBar`** in `src/components/market/MarketChrome.tsx`: the phone
  title bar with back arrow, title, subtitle and up to 2 icon buttons.
  - `MarketShell` gets a `phoneHeader="logo" | "page" | "none"` option, which
    replaces today's `bare`.
  - On phones, the logo bar shows only on Home.
- **Desktop header** as in the pictures:
  - nav underline;
  - search icon button;
  - avatar with a photo, first name and ▾;
  - visitors get search, Log in and Sign up;
  - full width (`max-w-7xl` becomes a wide container with 24–32 px margins).
- **Phone bar:** icons and labels as in the pictures; the active tab is green
  with an underline.

Owner test:
- Open Home, Find a Home, Saved, Messages and More on a phone and a computer.
  The new font is used everywhere.
- On a phone, the browser's top bar is green.
- Household pages (Money, Cleaning, Chat) look the same apart from the
  lettering.

### 13b — Home (`src/app/page.tsx`)

Build:
- The phone logo bar with the avatar.
- The headline and subtitle.
- The search box.
- Quick chips **Filters · Price ▾ · Bedrooms ▾ · Move-in date ▾**. Each ▾
  opens a small picker on the spot instead of going to the Filters screen.
- The "Already have a place?" card with the household icon, chevron and two
  buttons.
- A tile grid with the price on the photo, photo dots, title, place, and
  "2 bd · 1 ba · Available Nov 1".
  - The heading is **"Based on your last search"** when there is one,
    otherwise **"Latest listings"**, with **See all ›**. It's an honest
    label, not "Recommended".
- The 11a question card stays, made more compact.
- The visitor home gets the same pieces.
- **Owner's request (2026-10-16):** "I'm looking for… Room to share · Whole
  apartment" appears twice on the signed-out Home (the "Looking for" field in
  `src/components/landing/SearchPanel.tsx` and the chip row under it). Keep
  the field and remove the chip row.

Owner test: phone and desktop. Price, Bedrooms and Move-in date each open a
picker, and choosing one opens Find a Home with that filter.

### 13c — Search results (`src/app/listings/page.tsx`, `ListingCard.tsx`)

Build on phones:
- `PageBar` with back, the place, "N listings · 2 people · $500–$5,000+" and
  the sort button.
- A chip row (place · people · price · beds), each opening its picker.
- Tabs **All · Apartments · Rooms · Houses** with counts, per property type
  and room. This needs the counts that `/api/listings/search` already
  returns, plus counts per property type.
- Row card exactly like the picture:
  - the photo takes 45% of the card, with "New", the heart and the price on
    it;
  - title on 1 line;
  - "Brooklyn, NY 11216";
  - one line of facts;
  - Available;
  - up to 4 chips on one row.

Build on desktop:
- The picture's card: **$1,200/month** headline, title, place, "2
  occupants · 1 bedroom · 1 bathroom", chips, and the advertiser's photo,
  name and "2 days ago".
- A Grid / List toggle.

Data:
- `src/lib/listingCards.ts` adds `owner.photo` (the profile photo only).
- A test checks the search sends the photo but never email or private
  fields.
- The 11a card leaves this page (it stays on Home).

### 13d — Filters + the 4 new details (`FilterPanel.tsx`, `listingFields.ts`, `listingSearch.ts`, `ListingForm.tsx`, schema)

Build the phone Filters screen like the picture:
- a sheet with a handle;
- "Clear" on each section;
- **a price slider with two handles** and value bubbles, while keeping
  typed min and max;
- Property type: All · Apartment · Room · House;
- Bedrooms: Any · Studio · 1 · 2 · 3+;
- Occupants;
- Bathrooms;
- a move-in date field;
- **Additional options with an icon each**: Furnished, Pet friendly, Parking,
  Laundry, Wi-Fi, Air conditioning, Elevator, Heat included, Dishwasher;
- a sticky "Show N listings" button.

Build the desktop sidebar like the picture: checkboxes for property type and
amenities, the slider, and "Apply filters".

New details:
- `Listing` gets `airConditioning`, `heatIncluded`, `dishwasher` (Boolean?)
  and `squareFeet` (Int?).
- SQL file `prisma/manual-sql/2026-10-xx-sprint-13d-listing-extras.sql`.
- The new details go in `detailsSchema`, `detailsData` and `AMENITIES` and
  become filters.
- Tests: filters, validation, square feet range.
- **The owner's OK is required before applying the SQL on the live site.**

Owner test:
- Filters on the phone and on a computer.
- Edit your listing: tick Air conditioning and enter square feet, then check
  the filter finds it.

### 13e — Listing page (`src/app/listings/[id]/page.tsx`)

Phone:
- No logo bar; the photo fills the top with round back, heart and share
  buttons and "1 / N", then a strip of thumbnails.
- The title, then the **green price**, then the place.
- **Facts in 3 columns with dividers**: bedrooms · bathrooms · Max people /
  type · sq ft · Available.
- The roommates banner.
- **Amenities as chips with icons**, "See all ›" when there are more than 8.
- The description with "Show more".
- The neighborhood card (no map until 12f): neighborhood name and "exact
  address in Messages".
- The advertiser card with photo, "Email confirmed", "Member since", ›.
- Save and Contact stay pinned above the phone bar.

Desktop: the gallery on the left and a sticky card on the right (price,
facts, Save, Contact, advertiser).

### 13f — Saved (`src/app/(market)/saved/page.tsx`)

Phone:
- `PageBar` "Saved · Your saved listings (N)" with a search icon (opens the
  search field) and "…" (sort).
- Cards like the picture: photo with a red heart and the price, title, place,
  facts, Available, **View details** and **Message** buttons, and a "…" menu
  (Remove, Share).

Desktop:
- A left panel: All saved, Apartments, Rooms, Houses, with counts.
- The grid card from 13c, "N photos" on the photo, "Saved 2 days ago".
- A Grid / List toggle and Sort by.

### 13g — Messages (`inbox/page.tsx`, `[id]/messages/page.tsx`, `Conversations.tsx`)

Phone inbox:
- `PageBar` "Messages" with a search icon (filters conversations).
- Tabs **All (red unread count) · Places I asked about · My listings**.
- Rows like the picture: **person's photo**, name, role, time, **unread
  count** badge, last message on 2 lines, the listing mini-card with ›.

Phone conversation:
- **No logo bar and no bottom bar.**
- A header with back, the person's photo, name and role.
- The listing card: photo, title, green price, facts, place, **View
  listing**.
- "Today" date separators, bubbles with the person's photo, time and ✓✓.
- A full-width message box at the bottom with a round green send button.

Desktop: full-width three panels like the picture.
- Left: Messages, search conversations, tabs.
- Middle: the person's header and the chat.
- Right panel:
  - the listing card (photo 1/N, price, title, place, facts, "View full
    listing");
  - **Contact information** (photo, role, member since, Email confirmed);
  - **Quick actions**: Save listing, Share listing, Report this listing.

Data: `/api/listings/inbox` and the thread API add the other person's photo,
with a test that no email is sent.

### 13h — More, How It Works, Help, Create a Home, Join a Home

- **More:**
  - `PageBar` with the settings gear;
  - the profile card with photo and camera badge, linking to the profile;
  - the "Still looking for a place?" card with the house-and-magnifier
    illustration;
  - Housing, Search & listings, Messages and Account sections like the
    picture.
- How It Works and Help: same font and cards.
- Create a Home and Join a Home: spacing, field icons and toggles' look
  matched to their pictures. Same steps as today, only the look changes.

## Files touched most

- `src/app/globals.css` and `src/app/layout.tsx` (13a).
- `src/components/market/MarketChrome.tsx`: `PageBar`, header, phone bar,
  `MarketShell` options.
- `src/components/market/ListingCard.tsx` (row, grid, tile and new "saved"
  layouts), `FilterPanel.tsx`, `Conversations.tsx`.
- `src/components/landing/icons.tsx`: new icons for snowflake, flame,
  dishwasher, ruler/area, camera, gear, grid and list.
- Pages: `src/app/page.tsx`, `src/app/listings/page.tsx`,
  `src/app/listings/[id]/page.tsx`, `src/app/listings/inbox/page.tsx`,
  `src/app/listings/[id]/messages/page.tsx`,
  `src/app/(market)/saved|more|how-it-works|help/page.tsx`,
  `src/app/apartment/create|join/page.tsx`.

Reused as is:
- `src/lib/listingSearch.ts` (`parseFilters`, `filtersToParams`,
  `activeChips`, `searchWhere`);
- `src/lib/listingFields.ts` (`amenityLabels`, `placeKind`, `feeLabel`);
- `useMe`;
- the saved store (`src/components/market/saved.ts`);
- `useConversations`;
- `SetupShell` (`src/components/homeSetup/SetupShell.tsx`).

## Verification

- Every step: screenshots at 390 px and 1536 px placed beside the matching
  picture, typecheck, all tests (new tests: owner photo without private
  fields in 13c and 13g; the 4 details in 13d), lint ratchet not worse, CI
  green, `verify-live.sh` all 200 after deploy, then the owner's test and
  sign-off.
- 13a also re-checks the household pages (Money, Cleaning, Shopping, Chat,
  Calendar) at phone and desktop sizes, because the font changes app-wide.
