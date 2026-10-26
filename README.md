# medex: Service Explorer (Task 1)

Browse and filter the MedEx service catalogue: 3,200 services from 67 providers, grouped into provider cards. Filter counts update live, prices never mix currencies, and the whole view lives in the URL.

```
medex/
├── client/   # React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Vitest
└── server/   # Express 5 + TypeScript mock API; data in server/data/task1-service-explorer.json
```

## Getting started

Requires Node.js 20 or newer. From the repo root:

```bash
npm install    # installs root tooling, then server/ and client/ dependencies
npm run dev    # starts the API (http://localhost:3001) and the app (http://localhost:5173)
```

Open http://localhost:5173. Vite proxies `/api/*` to the Express server.

| Root script     | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Run server and client together (concurrently) |
| `npm run build` | Build server, then client                     |
| `npm run lint`  | Lint the client                               |
| `npm test`      | Run client unit tests (Vitest)                |

The root `package.json` only holds scripts; it is not an npm workspace. See [client/README.md](client/README.md) and [server/README.md](server/README.md) for each app on its own.

### Trying the loading and error states

The mock API is slow or fails on demand. Add these to the app's URL; the client forwards them to every API request:

| URL                                    | Shows                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| `/?mockDelay=5000`                     | Skeletons, then "taking longer than usual" after 3 s               |
| `/?mockFail=services`                  | Full error with **Try again** (also `providers` or `all`)          |
| `/?mockFail=categories`                | Partial data: results with a notice, category filter disabled      |
| `/?mockFailRate=0.5`                   | Random failures, retried automatically                             |
| DevTools → Network → Offline           | Offline state before loading; an offline banner after loading      |

## What the brief asked for, and where it stands

✅ done · ◑ done with a caveat · ✗ not done

| Requirement | Status | Notes |
| --- | --- | --- |
| Services grouped by provider; at most 3 per card plus "View all N services" | ✅ | N reflects the active filters. "View all" expands the card in place ("Show fewer" to fold it); expanded cards are kept in the URL. |
| Filters: type, category → subcategory, provider (searchable), city/country, price range, home test | ✅ | Price range applies per currency, see [Prices and currencies](#prices-and-currencies). |
| Free-text search over title, provider and category | ✅ | Every word must match; case and accents are ignored. |
| Live facet counts; zero-result options hidden or disabled | ✅ | Disabled, see [Facet counts](#facet-counts). |
| Final price = after discount + service charge; round only for display; strike through the original | ✅ | |
| Wellness services priced by duration | ✅ | Shown as "From" the cheapest duration, e.g. "3 durations, 30–120 min". |
| Never mix or convert currencies | ✅ | |
| Visibility: service active, provider active, category active | ✅ | 2,853 of 3,200 services are visible. |
| Sorts: relevance, price low → high, price high → low, rating | ✅ | Relevance is defined in [Sorting](#sorting). |
| URL is the source of truth (filters, sort, page), including reload, sharing and Back/Forward | ✅ | |
| Mobile: filters in a drawer whose "Show N results" counts the pending selection | ✅ | |
| Filter updates within ~100 ms, typing never blocks, no layout shift | ✅ | Measured, see [Performance](#performance). |
| States: skeleton, empty results with a way out, API failure with retry, mock API that fails on demand | ✅ | |
| States: partial data, slow, offline | ✅ | |
| Accessibility: full keyboard use, result count announced | ◑ | Built in and checked in code and headless browsers; not yet walked through with a real screen reader. See [What was left out](#what-was-left-out). |
| README, tests for the key logic | ✅ | 188 tests, see [Tests](#tests). |
| Facet counts stay correct with several filters active | ✅ | Tested against brute force on the real data. |
| Two top-level categories share the slug `ultrasound` | ✅ | Categories are keyed by id and grouped by type. |
| Handle the data's mistakes | ✅ | See [Known data issues](#known-data-issues). |

## Decisions and trade-offs

### How the app is put together

- **The server stays simple.** It returns the JSON as is from three endpoints that mirror the MedEx API (`/api/category/active`, `/api/providers`, `/api/service`), with latency and failure switches. All filtering happens in the browser: with 3,200 services that takes a few milliseconds, and live facet counts need the whole set anyway. With a much larger catalogue, filtering and counting would move to the server.
- **One normalisation layer** (`client/src/domain/catalog.ts`) turns the raw API shapes into clean domain types once:
  - It parses money strictly and applies the visibility rules.
  - It tidies text and records every data problem in an `issues` list instead of throwing.
  - Everything after it works with clean data.
- **Pure functions do the work**, so they are easy to test: pricing, categories, facets, the filter engine, and the URL format. React components only display results and send changes back.
- **TanStack Query** fetches the three resources separately:
  - It retries server and network errors twice, but never retries a malformed response.
  - It pauses while offline.
  - The three query states combine into one page status: loading, offline, error or ready (possibly with missing categories).

### Prices and currencies

- **Formula.** `final = (price − discount) + service charge`. Discounts and charges are each a percentage or a fixed amount. A percentage service charge is taken on the discounted price. All maths stays unrounded; `formatMoney` is the only place that rounds, using `Intl.NumberFormat` per currency.
- **Strike-through.** The original is only struck through when the final price is actually lower; 31 prices have a service charge that cancels the discount.
- **No price.** A missing or unusable price shows **Price on request**. It goes last in price sorts and is excluded by a price range.
- **The currency belongs to the provider** (THB, NPR, INR) and is never converted. The price filter therefore starts with a currency choice:
  - The min/max range only appears once a currency is chosen. A range in one currency means nothing in another.
  - When the current results have only one currency left (for example, after choosing Nepal), it is preselected. It is not written to the URL until a range is set.
  - Changing currency clears the range.
- **Price sort across currencies** groups results by currency, then by price, and shows a notice suggesting a currency is chosen to compare like for like.
- **Wellness services** sort and filter by their cheapest duration (the "From" price).

### Facet counts

- **Each option shows the results you would get by ticking it, given every other active filter.** The engine works this out in one pass over the services: a service that fails only one facet's filter still counts towards that facet. The currency facet also ignores the price range, which is cleared whenever the currency changes.
- **Options with zero results are disabled, not hidden.** The filter layout stays stable as you click, you can see what exists but is ruled out by other choices, and a selected option always stays enabled so it can be cleared.
- **Within one facet, choices combine with OR; across facets, with AND.** Country and city form one location facet: a service matches if its country or its city is selected.
- **Selecting a parent covers its children.** A selected category includes its subcategories, and a selected country includes its cities. The children show as checked and locked, and any of them selected before are dropped. A partly selected parent shows as indeterminate.

### Categories and the duplicate `ultrasound` slug

- Two top-level categories share the slug `ultrasound` (one for packages, one for lab tests), and three subcategories share `thyroid`. Categories are therefore matched and stored by **id**, never by slug.
- The filter tree groups top-level categories under their service type, so the two "Ultrasound" entries read as Packages › Ultrasound and Lab Tests › Ultrasound.
- **Trade-off:** category ids make the URL less readable than slugs would (`?category=<id>`). Readable `type:slug` keys would work too but need a lookup in both directions; ids were chosen for simplicity.

### URL state

Every filter, the search, sort, page and expanded cards live in the query string, so a view can be reloaded, shared or walked through with Back. For example:

```
?q=thyroid&type=lab_test&country=TH&currency=THB&min=500&max=2000&home=1&sort=price-asc&page=2
```

- **The URL stays short.** Defaults are left out, lists are comma-separated, and other parameters (such as the `mock*` flags) are kept.
- **History follows intent:**
  - A filter, sort or page change adds a history entry.
  - Typing a search adds one entry for the first character, then updates it in place.
  - Expanding a card updates the URL in place, so Back doesn't fold cards one by one.
- **A hand-edited or stale URL never breaks the page:**
  - Malformed values fall back to defaults.
  - Unknown types, categories, providers, places and currencies are dropped, and a reversed price range is swapped.
  - An out-of-range page shows the last page.
- **Pagination links are real `<a href>` links,** so a page can be opened in a new tab.

### Sorting

| Sort | Order |
| --- | --- |
| Most relevant, with a search | Matches in a title word first, then elsewhere in the title, then the category, then the provider name. Ties go to the better-reviewed provider. |
| Most relevant, no search | Providers by a review-weighted rating, which pulls ratings with few reviews towards the average (a rating needs about 25 reviews to count at face value). So 5.0 from 2 reviews doesn't outrank 4.7 from 1,200. |
| Price | By final price (the "From" price for wellness). Price on request goes last. Grouped by currency when currencies are mixed. |
| Top rated | Provider rating, then number of reviews. Unrated providers go last. |

Provider cards follow their best service in that order, and services within a card keep it too. Pages hold 10 provider cards.

### States

- **Loading:** skeletons shaped like the real cards and sidebar. After 3 seconds a line says it's taking longer than usual.
- **Error:** a full error with **Try again** when services or providers fail. The message depends on the cause (offline, network, server, or a response we couldn't read).
- **Partial data:** if only categories fail, results still show, with a notice, a retry button and the category filter disabled. Accepted risk: until categories load, the 41 services in the inactive "Seasonal Offers" category can't be hidden.
- **Offline:** before loading, an offline panel that loads automatically when the connection returns. After loading, a banner, and browsing continues.
- **Empty results:** "No services match your search" with a **Clear search and filters** button.

### Mobile

- Below 1024 px the sidebar becomes a **Filters** button that shows how many filters are applied and opens a drawer.
- **The drawer works on a draft.** Counts and the **Show N results** button update as you tick, while the results behind stay put.
- **Show N results** applies everything as one history entry. Closing the drawer any other way discards the draft. With no matches, the button is disabled and **Clear all** sits next to it.

### Accessibility

- **Native controls.** Checkboxes, radio buttons, selects and links are all native elements. Filter groups are `fieldset`/`legend`, and the tree toggles use `aria-expanded` and `aria-controls`.
- **Announcements.** The result count is announced in a polite live region on every change, and the drawer announces its pending count. Price range errors are linked to their fields and announced.
- **Keyboard:**
  - The drawer traps focus, closes with Escape and returns focus to its button.
  - Changing page moves focus to the top of the results.
- **Contrast.** The brand orange was darkened so all text meets WCAG AA. White on the button gradient was 2.3 : 1 and is now at least 4.5 : 1. The values are recorded in `client/src/index.css`.

## Performance

**Target:** filter updates within ~100 ms, typing never blocks, no layout shift.

**How it was measured:**
- The app ran on the dev server, so these are worst-case numbers with React's development build.
- Headless Microsoft Edge was driven through the Chrome DevTools Protocol, at a 1366 × 900 viewport.
- **Filter clicks:** each service type was ticked and unticked three times (15 clicks).
- **Typing:** "blood test" was entered as real key input (10 characters).
- **Latency** is the time from the input to the next painted frame, taken after two `requestAnimationFrame` callbacks.
- **Layout shift** was summed from `layout-shift` entries over the load and all interactions.
- Each run was repeated with the CPU slowed 4×, to stand in for a mid-range phone.

| | Normal CPU | CPU slowed 4× |
| --- | --- | --- |
| Filter click → painted (median / worst) | 18 ms / 34 ms | 61 ms / 80 ms |
| Keystroke → painted (median / worst) | 22 ms / 39 ms | 38 ms / 39 ms |
| Filter engine alone, per update (median / worst) | 2.5 ms / 6.1 ms | 6.8 ms / 19.5 ms |
| Cumulative layout shift (load + interactions) | 0.019 | 0.019 |

Everything stays under 100 ms, and layout shift is well under the 0.1 "good" threshold; the small amount happens during the initial load. Typing never waits on anything slow, so no deferral or debouncing was needed.

**What keeps it fast:**
- The search index (normalised text and provider scores) is built once per load.
- Each change is one pass over the services that filters, scores and counts every facet at once.
- Only one page of 10 cards is rendered.

**To check it yourself:** open DevTools → Performance, record while clicking filters, and look for the `explore` measure in the Timings track. Every filter update is recorded there with `performance.measure`. The CPU can be slowed from the same panel.

## Tests

`npm test` runs 188 tests in 24 files (Vitest, Node environment). Most of them run against the real `task1-service-explorer.json`, not just fixtures.

- **Pricing and money:**
  - discount and charge types
  - percentage charge on the discounted price
  - rounding only in display
  - "Free", "Price on request" and the strike-through rule
- **Catalog:**
  - every visibility rule, with the real counts (198 inactive services, 108 from inactive providers, 41 in inactive categories)
  - duplicate ids, untidy titles, unrated providers, and partial data
- **Categories:** the duplicate `ultrasound`/`thyroid` slugs, parent and child matching, and the tree grouped by type.
- **Filter engine:**
  - every facet option's count checked against "select only this option", with a search, two types, a country and home test all active
  - plus search, relevance, every sort, currency grouping, paging and the preselected currency
- **URL state:** parsing, round trips, malformed values, unknown ids, and keeping the `mock*` params.
- **Fetching:** retry rules, page status from the three queries, and error messages.
- **Components:** rendered to static HTML and checked for structure and accessibility attributes (cards, states, filters, pagination, drawer trigger).

Interactions (clicking, typing, Back and Forward, the drawer) were checked in headless Edge at 375, 640, 900 and 1366 px. They aren't automated in the repo; see below.

## What was left out

- **Browser tests in the repo.** Component tests render static HTML. Interaction tests (Playwright, or Testing Library with jsdom) would be the next addition.
- **A screen-reader walkthrough** (VoiceOver/NVDA) and automated axe checks.
- **Back button closing the mobile drawer.** It goes back a page instead. Fixing it means adding a history entry when the drawer opens.
- **Touch target size.** The small show/hide toggles in the category and location trees are 28 px, below the 44 px guideline.
- **Reduced motion.** The drawer's slide animation hasn't been checked against `prefers-reduced-motion`.
- **Dark mode.** The theme has dark tokens, but the page hasn't been designed or checked in dark mode.
- **Cleaning the URL on load.** Unknown or invalid params are ignored at once, but only disappear from the address bar at the next change, to avoid adding a history entry the user didn't ask for.
- **Smarter search.** There's no typo tolerance, stemming or synonyms; relevance is simple word scoring.
- **Number formatting** is English (`en`) only.
- **Server-side filtering and pagination**, which a much larger catalogue would need.

## Where AI tools were used

This was built with Claude Code (Anthropic) as a pair programmer, inside VS Code:

- **Analysis and plan:** Claude read the brief and the data and proposed edge cases, open questions and a step-by-step plan. The developer made the product decisions, including:
  - how "View all" behaves
  - partial-data handling
  - category ids in the URL
  - Title Case labels
  - the order of the steps
- **Code and tests:** Claude wrote the code and tests one small step at a time. The developer reviewed each step and made every commit.
- **Data issues:** Claude found them by querying the JSON. The handling of the bigger ones ("Price on request" for a discount larger than the price, documenting issues for the data owner) was agreed with the developer.
- **Measurement:** Claude wrote and ran the performance script and the screenshot checks (in headless Edge).
- **This README:** drafted by Claude.

## Known data issues

Problems found in `server/data/task1-service-explorer.json`. The client never edits the source data. It works around each problem when it normalises the data (`client/src/domain/catalog.ts`) and records it in the catalog's `issues` list.

### Needs fixing at the source

| Issue | Example | What the app does | Suggested next step |
| --- | --- | --- | --- |
| A fixed discount bigger than the price | "Vitamin D Test": price 450, discount 600 (THB) | Shows **Price on request** and leaves the service out of price filters and price sorting. Capping the price at 0 would show "Free", presenting a data error as an offer. Wellness durations with this error are dropped. | Data owner corrects the record. The API or admin tool should reject a discount larger than the price (and percentage discounts over 100%). |
| Untidy title | `"  hba1c   TEST (Diabetes) "` | Trims and collapses spaces; keeps the original casing. | Data owner fixes the title. Trim titles on save. |
| Service that looks miscategorised | "Physiotherapy Appointment" under Vaccination › Travel Vaccines | Shown as is: the category can't be second-guessed automatically. | Data owner reviews the category. |

### Handled by design

| Situation | What the app does |
| --- | --- |
| Two top-level categories share the slug `ultrasound` (package and lab test), and three subcategories share `thyroid` | Categories are matched and stored in the URL by id, never by slug. The filter tree groups top-level categories by service type to tell them apart. |
| 5 providers have a `null` rating and 0 reviews | Shown as "No reviews yet". A rating with no reviews behind it is treated as unrated. |
| 198 inactive services, 108 services from 2 inactive providers, and 41 services in the inactive "Seasonal Offers" category | Hidden (2,853 of 3,200 services are visible). |
| Wellness services have `price: null` and price by duration | Shown as "From" their cheapest duration. |
| "Free Dental Consultation" has a price of 0 with no discount | A legitimate price, shown as "Free". |
| 31 discounted prices where the service charge cancels out the discount (e.g. "Home HbA1c Test": listed NPR 5,690, final NPR 5,724.50) | The original price is only struck through when the final price is actually lower, so no saving is advertised that isn't there. |
| No visible service has "Ultrasound" in its title (the one that does, "Thyroid Ultrasound", is hidden) | Searching "ultrasound" still finds services through their category name. |

---

# Task 2: Multi-provider cart and split checkout (in progress)

This section grows as the task is built; the full write-up (state machine, double-charge prevention, trade-offs) comes at the end.

## Guest cart merge

When a guest logs in, the cart saved on their device is merged into their account's cart (`POST /api/cart/merge`, logic in `server/src/cart/merge.ts`). Every item is merged on its own, so one bad item never blocks the rest, and the server reports each outcome in `changes` so the customer can be told exactly what happened.

### The cases in the data

The guest cart in `server/data/task2-cart.json` overlaps the account's cart in four ways:

| Guest item | Account's cart | What happens | What the customer is told |
| --- | --- | --- | --- |
| Liver Function Profile ×3 | Same test ×2 | The line keeps the **larger** quantity: 3. | "Liver Function Profile: kept 3 from before you logged in (your account had 2)." |
| Lipid Profile ×1 | Not there | Added as a new line. It joins the lab tests group (THB, Lotus Pathology). | "Lipid Profile added." |
| Signature Facial, 90 min | Same facial, **no duration chosen** | The guest's 90 min choice is applied to the existing line. No second facial is added. The wellness group now has a price (THB 2,040) and can be checked out. | "Signature Facial: we used the 90 min you chose earlier." |
| Product `6b572fa4-…` | Not there, and not in the catalog | Not added. | "1 item you added before logging in is no longer offered." |

### The rules behind them

- **Quantities are never added together; the larger one wins.** A customer who had 2 of a test in their account and later put 3 in a guest cart almost certainly wants 3, not 5. Adding them would book (and charge for) tests nobody asked for, and in healthcare an extra lab test is not a harmless extra. The cost: a customer who really wanted 5 has to tap "+" twice, and the message tells them what was kept. A useful side effect is that the merge is **safe to repeat**: if the response is lost and the client sends the guest cart again, nothing changes the second time.
- **A wellness duration chosen as a guest fills in a missing one.** If the account's line has no duration yet, the guest's choice is used, because that's the most recent decision the customer made.
- **Two different durations stay as two lines.** A 60 min and a 90 min facial are different bookings, so neither overwrites the other. A guest item with no duration folds into the account's existing line for that service.
- **Products that aren't in the catalog are skipped and reported.** The data gives no title for them, so the message can only say how many items were skipped.

### Edge cases the data doesn't contain, handled anyway

| Situation | What happens |
| --- | --- |
| Merged quantity over the booking limit (10) | Capped at 10, and the customer is told. |
| The guest's chosen duration is no longer offered | The service is added without a duration, and the customer is asked to choose one. |
| Unreadable item (no product id, quantity 0, negative or not a whole number) | Skipped and reported; the other items still merge. |
| The same product twice in the guest cart | Merged with the same "larger wins" rule. |

## Changing quantities

Quantity changes are optimistic (`client/src/state/quantitySync.ts`). The new number shows the moment "+" or "−" is tapped, and the line's price and the group and cart totals update with it.

- **One request per line at a time, newest value wins.** While a change is being saved, further taps only move the target; when the request returns, the latest target is sent. Five quick taps from 1 send two requests (2, then 6), in order, and the screen goes 2, 3, 4, 5, 6 without jumping back. Tapping back to the saved value sends nothing more. Lines don't wait for each other.
- **Out-of-order responses can't undo anything.** Every write returns the whole cart, and responses can arrive in any order. A response to an earlier request never replaces one to a later request (`client/src/state/cartWrites.ts`), and quantities the customer touched stay on top of the cached cart until a reload, made once everything has settled, confirms them.
- **When the server refuses, the line goes back and says why.** A 409 or 500 restores the last quantity the server accepted, and the line shows (and announces) the reason, e.g. "You can book up to 10 of one service at a time. It's back to 10."
- **When the outcome is unknown, the cart is reloaded instead.** If the connection drops mid-request, the change may or may not have been saved, so rolling back could be just as wrong as keeping it. The cart is reloaded and the line says so.
- **Offline:** steppers are inactive, and the banner explains that changes wait until the connection is back.
- **No client-side maximum.** The server owns the booking limit; the client shows its 409 rather than duplicating the rule.
- **Keyboard:** "−" at 1 is marked `aria-disabled` rather than `disabled`, so focus isn't thrown back to the top of the page. Going below 1 means removing the item, which gets its own button.

## Choosing a duration and removing items

- **Wellness durations are a radio group** ("60 min · THB 1,800"), labelled with the service's name for screen readers, so arrow keys move between them. The choice shows at once; the price, group status and summary update when the server confirms it. Until then the price says "Price shown once you choose a duration" and is never counted as zero. If the duration is no longer offered (409), the line says so and the cart is reloaded.
- **Every line has a Remove button**, outlined for services the provider removed, since removing is the only thing left to do with them. A removal isn't optimistic: the line stays, showing "Removing…", until the server confirms, so a failure doesn't make a removed line reappear. There's no confirmation dialog or undo: the item can simply be added again.
- **Focus after a removal** goes to the next line in the group, else the previous one, else the next (or previous) group's heading, else the page heading once the cart is empty. The removal is also announced ("CBC Profile was removed from your cart.").
- **No stale reloads.** Both actions cancel any cart reload in flight first, and take part in the same response ordering as quantity changes, so an older response can't bring back a removed line or an old duration.

## Checkout: the state of each order

Each group in a checkout becomes its own order, paid on its own, so each has its own state (`client/src/domain/checkout/machine.ts`). "Pay for everything" submits the groups one after another, in the cart's order, and carries on past a failure, so one problem never holds up the rest.

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> submitting: send POST /checkout<br/>(saved first)
    submitting --> confirming: 201, card
    submitting --> booked: 201, pay at clinic
    submitting --> paid: 201, already paid
    submitting --> interrupted: 500 / no response / offline / page reloaded
    submitting --> declined: 402
    submitting --> cart_changed: 409
    submitting --> rejected: 400 / key reused
    confirming --> paid: GET /orders → paid
    confirming --> payment_failed: GET /orders → failed
    interrupted --> queued: retry, SAME key
    declined --> queued: retry, NEW key
    payment_failed --> queued: retry, NEW key
    cart_changed --> queued: accept the cart as it is now, NEW key
    paid --> [*]
    booked --> [*]
    rejected --> [*]
```

### What the customer sees

- **From the cart:** each ready group has its own "Book" button, and the summary offers "Book all 3 groups" (or "Book the 2 ready groups" while one still needs a duration). The choice goes in the URL (`/checkout?groups=package,lab_test`), so a reload keeps it.
- **Review:** each group is shown as "Order 1: Packages", with its items, providers, totals per currency and its own payment method (card, or pay at the clinic; insurance is card only). The page says plainly that these are separate orders and that one problem won't affect the others. Nothing is sent until "Place 3 orders".
- **Results:** one card per order, in plain terms of money and booking: "Paid and booked", "Booked. Pay at the clinic", "Your card was declined. No order was placed and you haven't been charged", "We couldn't confirm this order. Trying again is safe: you will never be charged twice for it." Orders that exist show a short reference. A sentence at the top ("2 of 3 orders done, 1 needs your attention") is announced to screen readers as it changes.
- **Retry only what failed:** "Try again" appears only on orders that can be retried, plus "Try all 2 again" when there are several. After a decline or a failed payment the customer can switch to paying at the clinic first. If the cart changed, they can place the order again with the cart as it is now.
- **Leaving:** while an order is in progress or its outcome is unknown, the page offers "Back to cart" and keeps the checkout; the cart shows a banner linking back to it, and won't start another checkout until it's resolved. Once everything is settled, "Done" (or "Leave the rest in my cart") clears it. Checkout runs outside the page component, so leaving mid-checkout neither stops it nor starts a second copy on return.
- **Focus:** placing the orders moves focus to the results heading; retrying an order moves it to that order's heading, since the button that was pressed disappears.
- **No real card entry.** "Card" is a choice, not a form: a real integration would use the payment provider's hosted fields, which is out of scope for a mock.

### How double charges are prevented

- **Every attempt carries an idempotency key, and the key outlives uncertainty.** If we don't know whether an order was created (a 500, a dropped connection, the tab closed mid-request), the retry reuses the same key. The server either creates the order or returns the one it already made; it never makes a second one.
- **A key is spent only when we know no usable order came of it:** a declined card (402), a payment that failed after the order was made, a cart that changed (409), or a request the server refused (400). The next attempt is then a genuinely new order, with a new key.
- **The payment method is locked while a key is outstanding.** The first attempt may already have created an order by card; switching to "pay at clinic" with the same key would be a different request, which the server rightly refuses. Once the attempt is known to have failed, the method can change.
- **Retry only what failed.** Succeeded orders are never resubmitted; the retry action exists only for interrupted, declined and failed orders.
- **Late or duplicate events are ignored.** The reducer only accepts events that fit an order's current phase, so a double click or a response arriving after a reload can't move an order backwards.
- **One request at a time.** Orders are submitted one after another, which also keeps progress easy to follow.

### Reload safety

The checkout session (orders, items, payment methods, keys and phases) is saved to `localStorage` on every change, and **before** each request is sent (`client/src/domain/checkout/storage.ts`). If the page reloads or the tab is closed mid-checkout:

- an order that had a request out comes back as *interrupted*, and is **resent automatically with the same key** as soon as the page loads. The server returns the order if the first request made it, or makes it now; either way the page shows the truth without the customer doing anything ("Checking on this order… If it already went through, you won't be charged twice.");
- orders the customer had already asked to place but that hadn't been sent yet carry on in turn: they pressed "Place 3 orders", so restarting the checkout would be the surprise;
- an order waiting for its card payment carries on being checked with `GET /orders/:id`;
- finished orders show as finished; nothing starts again from scratch.

If the page loads offline, nothing is resent until the connection is back; orders that failed *because* the customer was offline are also resent on reconnect. Server errors (500) are left for the customer to retry, so a failing server isn't hammered.

**Tested by closing a real tab mid-request** (headless Edge, the package request held for 3 s by a mock rule): the saved session had `package: submitting` with its key and no response; the new tab resent that same key without a click, got back the order the first request had made (a second order would have been refused, since the package's items had already left the cart), then placed the two remaining orders.

**Two tabs** aren't synchronised: each tab runs the checkout it loaded. Because every resend uses the saved key, two tabs resolving the same order still produce one order. A real server must also handle two requests with the same key arriving at once (by locking on the key); the mock processes requests one at a time, so it doesn't need to.

A session that can't be read (corrupt, or an unknown version) is dropped rather than guessed at. If storage isn't available at all (some private modes), checkout still works but can't survive a reload.

## Known data issues (Task 2)

| Situation | What happens |
| --- | --- |
| A cart line whose `product` is `{}` (the provider removed the service) | The server puts it in an `unknown` group with no price. It can't be checked out or have its quantity changed (409 `unavailable`); it can only be removed. |
| The server cart's `subtotals`, `itemCount` and `totalItems` are precomputed | They match the lines in the data file, but the server recomputes them from the lines on every response rather than trusting stored totals. |
| Fractional prices (INR 23,009.50, THB 5,227.50) | Totals are summed in whole cents so they never drift (e.g. 0.1 + 0.2). |

## How the client reads the cart

The client never takes the cart's numbers on trust (`client/src/domain/cart/`). It keeps the server's groups, because each group is checked out as one order, but recomputes every count, line total and subtotal from the lines. Anything odd is recorded in the cart's `issues` list, as in Task 1.

- **A price is either known or blocking, never zero.** Each line is *priced*, *blocked* (price unknown) or *unavailable* (service removed). A blocked line stops its group from being checked out and is counted in the summary as "not priced yet"; it is never added to a total. Lines are blocked for: a wellness service with no duration chosen; a wellness service with no usable durations; a missing, negative or malformed price or currency; or a quantity that isn't a whole number of at least 1.
- **Wellness prices come only from the chosen duration.** A fixed `price` on a wellness service is ignored (and flagged), and the `priceUnknown` flag isn't relied on. Duration options without an id, a positive duration or a valid price are dropped. A selected duration the service no longer offers counts as not chosen.
- **Removed services are left out of orders, not blocking.** A removed service in a group that can otherwise be booked doesn't hold the group back: it is shown as unavailable and left out of that group's order. A group with only removed services (the `unknown` group in the data) isn't an order at all and is listed last.
- **Amounts always show the currency code** ("INR 23,009.50", not "₹23,009.50"). With up to three currencies side by side, a mix of symbols and codes is harder to compare. This also changed the explorer from Task 1, which used to show ₹.
- **The summary never adds currencies.** It shows one total per currency across all groups, how many separate orders the cart becomes, and how many items aren't priced yet.
- **Smaller tidying:** lower-case currency codes are accepted (`thb` → THB), titles are trimmed, a line with no id is skipped (nothing can be done with it), and server subtotals that disagree with the lines are flagged.
