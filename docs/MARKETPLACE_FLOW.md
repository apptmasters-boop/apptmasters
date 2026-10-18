# Marketplace / Pre-Household Flow

> The owner's document, saved as received on 2026-10-16 (headings, lists and
> tables restored; wording unchanged). It details the "Find a Home" phase of
> [`PRODUCT_LOGIC.md`](PRODUCT_LOGIC.md) §1–§4. It is built in **Sprint 12 —
> Find a Home**; the owner's decisions on it (fees, address privacy, map
> timing) and the slices are in [`BUILD_CHECKLIST.md`](BUILD_CHECKLIST.md).

**ApptMasters — Pre-Household Business Logic**

**New User Journey:** Search → Register → Save / Contact → Create or Join Home

Developer handoff document based only on the mobile and desktop mockups and
business rules already discussed and validated.

**Core principle:** Public browsing first. Account required only for personal
actions.

**Scope boundary:** this document stops when the user successfully creates or
joins a household and becomes a Resident. Resident Home, Household, Money,
Chat and More logic is handled separately.

## 1. Purpose

This flow covers users who are still looking for a place to live, whether they
are completely new visitors, registered users without a household, or users
who eventually find a place and are ready to create or join a household.

The goal is to let people search first and only require registration when
they need personal features.

The core principle is: Public browsing first. Account required only for
personal actions.

## 2. User States Covered

| State | Description | Access |
|---|---|---|
| Visitor | User is not logged in | Search, filters, listing results, listing details |
| Registered / No Home | User has an account but is not yet part of a household | Search, Save, Messages, profile-related options, Create Home, Join Home |

The next state, Resident, begins only after the user creates or successfully
joins a household. That resident logic is outside this document.

## 3. Public Home / Search

The main landing page is public. A visitor must be able to search listings,
use search filters, see search results, open listing details, and browse
without creating an account.

The platform should not force registration just to view apartments or rooms.

The main public search includes the filters already reflected in the mockups:
location, price range, number of occupants, and property type. Additional
filters can be opened through the larger filter experience.

## 4. Search Filters

The search logic should use real listing data. The agreed filter structure
includes:

- City
- Neighborhood
- ZIP code
- Radius
- Minimum price
- Maximum price
- Number of occupants
- Property type
- Room type
- Bedrooms
- Bathrooms
- Move-in date
- Furnished
- Lease duration
- Utilities
- Internet / Wi-Fi
- Private bathroom
- Laundry
- Parking
- Elevator
- Pets
- Smoking
- Accessibility
- Broker fee
- Application fee
- Listing age
- Sort order

The desktop mockup uses a left-side filter panel. The mobile version uses a
dedicated Filters screen or panel.

## 5. Number of Occupants Logic

Number of occupants means the total number of people who intend to live in the
property.

It does not mean the number of people currently searching, the number of
bedrooms, or the number of accounts involved.

Example: if one person is searching for a place for themselves and one other
person, the search should use Occupants = 2.

The listing must contain its own capacity information. The result logic must
compare the search value against the listing's declared max_occupants.

The system must not assume "2 bedrooms = 2 occupants" because listing capacity
must be explicitly declared.

## 6. Search Results

Search results should display listings that actually match the active
filters. Each result card can show the information already reflected in the
mockups:

- Main photo
- Monthly price
- Property or room type
- Location
- Occupancy capacity
- Bedrooms
- Bathrooms
- Selected amenities
- Advertiser information where available
- Save icon

The search page can include result count, sorting, Map / List view, and active
filters.

Active filter values should remain visible and removable, for example:
Brooklyn, Under $1,800, 2 occupants, Private room, Furnished. The user should
be able to clear individual filters or clear all.

## 7. No Matching Results

If there are no matching listings, the system should not invent or display
unrelated listings as matches. The user should see a clear empty state
explaining that no listings match the current filters. The existing search
criteria should remain available so the user can adjust them.

## 8. Map View

The desktop search mockup includes a map tied to the same search results.

- Listing markers correspond to matching listings.
- Clicking a marker opens basic listing information.
- Clicking the listing information opens the full listing.
- Filters update both the listing results and the map.

For privacy, the platform does not need to expose the exact private address
publicly. Approximate location or neighborhood-level display is acceptable
before direct interaction with the advertiser.

## 9. Listing Details

Listing details remain public. A visitor can open an individual listing
without registering.

The page should display the information already discussed and reflected in
the mockups:

- Property photos
- Monthly price
- Listing type
- Location
- Occupancy
- Bedrooms
- Bathrooms
- Furnishing status
- Description
- Amenities
- Availability
- Lease-related information
- Advertiser information
- Save
- Contact

## 10. Save Action

A visitor is allowed to view listings, but cannot save them without an
account.

1. Visitor opens a listing.
2. Visitor clicks Save.
3. System sends the user to Login / Sign Up.
4. After successful authentication, the system returns the user to the same
   listing.
5. The Save action is completed or resumed.

The user should not be redirected to a generic dashboard or homepage after
registration.

## 11. Contact Action

A visitor cannot contact an advertiser without an account.

1. Visitor clicks Contact.
2. System sends the user to Login / Sign Up.
3. After successful authentication, return to the same listing.
4. Preserve the user's previous context.
5. Continue the intended Contact action.

The user should not have to search for the listing again.

## 12. Authentication Return Logic

When login or registration happens because the user was trying to perform an
action, the system should preserve the current context:

- The listing
- The search criteria
- The intended action

Example: a visitor searches Brooklyn, max price $1,800, 2 occupants; opens a
listing; clicks Contact; creates an account. After account creation, the user
should return to that listing and continue contacting the advertiser.

There is no mandatory onboarding questionnaire immediately after signup.

> **Owner's change (2026-10-18, step O1):** the sign-up form now asks one
> required question, "What brings you to ApptMasters?" (I'm looking for a
> place · I already have a place · I have a place to rent out; the owner chose
> these "I…" sentences over "Set up my home", which read unclear). It comes
> pre-selected from what the person was doing (saving or contacting a listing
> → looking; "Already have a place?" → already have a place; "Post a listing"
> → rent out), and the action in progress still wins after sign-up. No other
> questions.

## 13. Header Logic Before and After Login

> **Owner's change (2026-10-17, fix F2):** on computers the top bar is only the
> logo and Log in / Sign up (signed out) or the logo and your name (signed in);
> Find a Home, Messages, Saved and the rest are in the menu under your name, and
> How It Works, Help and Post a listing are in a small footer.

**Visitor header**

- Home
- Find a Home
- How It Works
- More
- Log in
- Sign up

**Logged-in user without a household**

After login, Log in and Sign up must disappear.

- Home
- Find a Home
- Messages
- Saved
- How It Works
- More
- Notifications
- User avatar / profile menu

This rule applies across pages, not only Messages or Saved.

## 14. Saved Listings

Saved is only for logged-in users.

- View saved listings
- Remove listings from Saved
- Open a saved listing
- Search inside saved listings
- Sort saved listings

The mockup also showed custom folders, but we discussed that these can wait
and are not necessary for the MVP.

If a saved listing is no longer available, it should not silently disappear.
It should remain understandable to the user with a status such as unavailable
or removed.

## 15. Messages

Messages are only available to logged-in users. This is why the Messages
mockup should never show Log in or Sign up in the header.

When a user contacts an advertiser from a listing, open an existing
conversation if one already exists for that listing and those users;
otherwise create a new conversation linked to that listing.

The listing should remain visible in the conversation context so the user
knows which property the conversation is about.

## 16. Marketplace Conversation Logic

A marketplace conversation should stay related to the specific listing.

The conversation experience shown in the mockups includes a conversation
list, active conversation, listing preview, advertiser information, and
message composer.

**Desktop**

- Conversations on the left
- Chat in the center
- Listing context on the right

**Mobile**

- Inbox first
- Then conversation screen
- Listing information accessible from the conversation

## 17. Contact Is Not an Application

Contact ≠ Application. Starting a conversation with an advertiser does not
mean that the user has formally applied for the property.

The current pre-household flow is based on search, save, contact, and
conversation. We did not define a full application workflow.

## 18. Saved vs Contacted

Saved and Contacted are different user actions. A listing may be Saved only,
Contacted only, or Saved and Contacted. The platform should not treat one as
the other.

## 19. Advertiser Verification Information

The mockups displayed items such as Identity verified, Email verified, and
Phone verified. These labels must only appear if the platform has a real
verification process behind them. They should not be decorative or simulated
trust indicators.

## 20. How It Works

How It Works is a public explanatory page. Its role is to explain the product
simply.

| Step | Meaning |
|---|---|
| Find | Search apartments, rooms, and shared housing. |
| Connect | Contact the advertiser. |
| Move in | Complete the lease and payment arrangements outside ApptMasters. |
| Manage together | After finding a place, create or join a Home and use the resident features. |

This page should remain simple and educational.

## 21. More

More is used for secondary functions. For a logged-in user without a
household, the options we discussed include:

- Profile
- My Listings
- Search History
- Create a Home
- Join a Home
- Notifications
- Settings
- Help
- Sign Out

Important everyday functions should remain directly accessible in the main
navigation.

## 22. Create a Home

A registered user who has found a place can create a Home even if the
property was found outside ApptMasters. Creating a Home is the transition
point toward the resident experience.

- Create the household
- Enter basic household information
- Invite roommates
- The user who creates the Home becomes the household admin

This is household admin, not platform super admin.

## 23. Join a Home

A registered user can also join an existing Home.

- Invitation code
- Invitation
- Request to join

The user can preview the Home before full membership where appropriate.
Household access should not be granted until the join process is approved,
unless a valid invitation explicitly authorizes direct entry.

Before approval, the user remains in the Registered / No Home state.

## 24. Transition to Resident

The transition does not happen automatically just because the user contacted
an advertiser or found a listing.

The user explicitly moves into the resident experience through Create a Home
or Join a Home. Once successfully associated with a household, the user
becomes Resident. At that point, the main application navigation changes to
the resident experience already worked on separately.

This document stops there.

## 25. Marketplace Access After Becoming Resident

Becoming a resident should not destroy the user's previous marketplace
history. The same account remains in use. Saved listings and previous
marketplace conversations should remain accessible. The marketplace itself
should still be reachable even after the resident navigation becomes the main
experience.

## 26. Responsive Logic

The mobile and desktop mockups represent the same product and the same
backend logic. There should not be separate business logic for mobile and
desktop.

| Mobile | Desktop |
|---|---|
| One-column layout | Top navigation |
| Compact navigation | Side filters |
| Filters screen or drawer | Multi-column search results |
| Separate inbox and conversation screens | Multi-panel Messages screen |

The visual layout changes, but account state, search logic, Saved logic,
Messages logic, permissions, and listing data remain the same.

## 27. Permissions

Even though the mockups are frontend designs, access restrictions must not
rely only on hiding buttons. The backend must enforce the rules.

- Visitor cannot save without authentication.
- Visitor cannot send a message without authentication.
- A user cannot read another user's conversation.
- A user without approved household membership cannot access household data.

## 28. Database-Relevant Information Already Implied by the Business Logic

This section does not define a new database schema. It only summarizes the
data relationships already implied by the validated business logic.

**User**
- Account identity
- Login state
- Current household relationship / state

**Listing**
- Location
- Price
- Property type
- Room type
- Bedrooms
- Bathrooms
- max_occupants
- Availability
- Furnished status
- Lease information
- Utilities
- Amenities
- Broker fee
- Application fee
- Active / inactive status

**Saved relationship**
- Which user saved which listing

**Marketplace conversation**
- Participants
- Related listing
- Messages

**Home / Household transition**
- Who created the Home
- Who is a member
- Join or invitation status

These are not new product requirements; they are the minimum data
relationships implied by the flow above.

## 29. Full User Journey

The full pre-household journey we defined can be summarized as follows:

| Step | State | Action / Result |
|---|---|---|
| 1 | Visitor | Home / Search |
| 2 | Visitor | Filters |
| 3 | Visitor | Search Results |
| 4 | Visitor | Listing Details |
| 5A | Visitor | Continue browsing anonymously |
| 5B | Visitor → Registered | Save → Login / Sign Up → Return to same listing → Save |
| 5C | Visitor → Registered | Contact → Login / Sign Up → Return to same listing → Start / continue conversation |
| 6 | Registered / No Home | Find a Home / Saved / Messages / More |
| 7 | Registered / No Home | User finds a place |
| 8 | Registered / No Home | Create a Home OR Join a Home |
| 9 | Resident | Membership becomes valid → Resident experience begins |

## Developer Handoff Note

The mockups are visual references, but the implementation must follow the
user states, permissions, return-after-authentication behavior, listing
relationships, and transition rules defined in this document. Mobile and
desktop are responsive presentations of the same product logic, not separate
applications.
