# medex

Full-stack app with a React frontend and a Node.js/Express backend. The two live side by side as independent projects, each with its own `package.json` and `node_modules`.

```
medex/
├── client/   # React + TypeScript + Vite, Tailwind CSS, shadcn/ui
└── server/   # Node.js + Express API (TypeScript); JSON data in server/data/
```

## Getting started

Requires Node.js 20 or newer. From the repo root:

```bash
npm install    # installs root tooling, then server/ and client/ dependencies
npm run dev    # starts the server (http://localhost:3001) and client (http://localhost:5173)
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` requests to the Express server, so no CORS setup is needed in development.

The root `package.json` only holds scripts; it is not an npm workspace. Each app keeps its own dependencies and can still be run on its own from its folder.

| Root script     | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Run server and client together (concurrently) |
| `npm run build` | Build server, then client                     |
| `npm run lint`  | Lint the client                               |
| `npm test`      | Run client unit tests (Vitest)                |

See [client/README.md](client/README.md) and [server/README.md](server/README.md) for more detail.

## Known data issues

Problems found in `server/data/task1-service-explorer.json`. The client never edits the source data: it works around each problem when it normalises the data (`client/src/domain/catalog.ts`) and records it in the catalog's `issues` list.

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
