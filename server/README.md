# medex — server

Minimal Node.js + Express API written in TypeScript. Data is read from JSON files in `data/`.

## Scripts

```bash
npm install
npm run dev        # run src/ with tsx, restarting on file changes
npm run build      # compile src/ (and the ../shared code it uses) to dist/ with tsc
npm start          # run the compiled build, dist/server/src/index.js (run `npm run build` first)
npm run typecheck  # type-check without emitting
npm test           # cart, checkout, booking and mock-rule tests (Vitest)
```

Runs on `http://localhost:3001` by default; override with the `PORT` environment variable.

## Service explorer endpoints (Task 1)

Paths mirror the MedEx API the data was shaped after. Records are returned exactly as they are in `data/task1-service-explorer.json`; normalising them and handling data quirks is the client's job.

| Method | Path                   | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/api/health`          | Health check                                   |
| GET    | `/api/category/active` | Top-level categories, each with `children`     |
| GET    | `/api/providers`       | Providers (status, currency, city, rating)     |
| GET    | `/api/service`         | All services (~1.7 MB)                         |

### Simulating a real network

Every data endpoint waits 300 ms by default (`MOCK_LATENCY_MS` env var changes this). Add these query parameters to any data request:

| Parameter                 | Effect                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| `mockDelay=<ms>`          | Replace the default latency (`0` turns it off, capped at 30 s)          |
| `mockFail=<names>`        | Return 500 for `all`, or a comma list of `categories,providers,services` |
| `mockFailRate=<0..1>`     | Fail randomly with that probability                                     |

Failing a single resource (e.g. `mockFail=providers`) simulates partial data.

```bash
curl 'localhost:3001/api/service?mockDelay=3000'      # slow
curl 'localhost:3001/api/providers?mockFail=providers' # 500
```

## Cart and checkout endpoints (Task 2)

Seeded from `data/task2-cart.json`. The cart and orders are held in memory: they change as you use them and reset when the server restarts (or via `POST /api/__mock/reset`). Groups, item counts and subtotals are recomputed from the cart lines on every response, in the `GET /v2/cart` shape.

| Method | Path                       | Body                                                                 | Responses                                    |
| ------ | -------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/cart`                |                                                                      | 200 `{ cart }`                               |
| PATCH  | `/api/cart/items/:lineId`  | `{ quantity }` and/or `{ wellnessPricingId }`                        | 200 `{ cart }`, 400, 404, 409                |
| DELETE | `/api/cart/items/:lineId`  |                                                                      | 204 (also when the line is already gone)     |
| GET    | `/api/catalog`             |                                                                      | 200 products the customer can add            |
| POST   | `/api/cart/merge`          | `{ items: guestCart }`                                               | 200 `{ cart, changes }`, 400                 |
| POST   | `/api/checkout`            | `{ groupType, items: [{ lineId, quantity, wellnessPricingId? }], paymentMethod, idempotencyKey }` | 201 `{ orderId, status }`, 400, 402, 409, 500 |
| GET    | `/api/orders/:orderId`     |                                                                      | 200 order, 404                               |

Errors are `{ code, message, details? }`. Notable codes:

- `quantity_limit` (409): more than 10 of one service.
- `unavailable` (409): the provider removed the service; the line can only be deleted.
- `option_unavailable` (409): the chosen wellness duration isn't offered.
- `cart_changed` (409): the checkout items don't match the cart any more. `details.mismatches` lists each line with a reason (`not_in_cart`, `wrong_group`, `unavailable`, `quantity_changed`, `option_changed`, `price_unknown`).
- `idempotency_key_reused` (409): the key was already used for a different checkout.

**Guest cart merge.** Each guest item is merged on its own, so one bad item never blocks the rest. Quantities are never added: the larger one wins, which also makes the merge safe to repeat. `changes` has one or more entries per item, each with a `kind`: `added`, `kept_larger_quantity`, `already_in_cart`, `duration_applied`, `duration_not_offered`, `quantity_capped`, `not_offered` or `invalid_item` (see `src/cart/merge.ts` for the fields). The rules and the reasons for them are in the root README.

**Idempotency.** The first successful checkout for a key is stored. Sending the same request with the same key again returns the same order (with its current status) and never creates another. Failed requests store nothing, so the key can be retried.

**Orders.** Checkout takes the group's lines out of the cart. Card orders start `pending` and settle to `paid` (or `failed`, see below) after a few seconds; a failed payment puts the lines back in the cart. Pay-at-clinic orders stay `pending`: the booking is made and payment happens at the visit. Insurance can only be paid by card.

### Failure injection (dev panel)

The query flags above also work here, with the resource names `cart`, `checkout`, `orders` and `catalog`. To fail one specific call, set rules at runtime:

| Method | Path                     | Description                                          |
| ------ | ------------------------ | ---------------------------------------------------- |
| GET    | `/api/__mock/config`     | Current rules and payment settlement                 |
| PUT    | `/api/__mock/config`     | Replace them                                         |
| POST   | `/api/__mock/reset`      | Restore the seed cart and bookings, forget all orders |
| GET    | `/api/__mock/guest-cart` | The guest cart from the data file                    |

A rule names an `endpoint` (`getCart`, `updateLine`, `removeLine`, `mergeCart`, `checkout`, `getOrder`, or a booking endpoint listed below) and any of:

- `status`: respond with this error status; `0` drops the connection.
- `when`: `before` (default) fails without doing the work; `after` does the work and then fails, like a response lost on the way back; `raced` (booking writes only) has someone else take the slot just before the request, which then gets a real `slot_taken` conflict.
- `delayMs`: extra latency.
- `match`: only requests whose body fields or route params equal these values.
- `times`: affect only this many matching requests.

`settlement` sets how card payments end: `{ "outcome": "paid" | "failed", "afterMs": 4000 }`.

`fullyBookedSpecialists` lists specialist ids to treat as fully booked on every day of the booking window (Task 3). The data file never leaves a specialist with no availability in 90 days, so this is how that state is shown.

```bash
# Decline the package group's next checkout, leave the others alone
curl -X PUT localhost:3001/api/__mock/config -H 'content-type: application/json' \
  -d '{"rules":[{"endpoint":"checkout","status":402,"match":{"groupType":"package"},"times":1}]}'

# Place the order but lose the response: a retry with the same key must return that order
curl -X PUT localhost:3001/api/__mock/config -H 'content-type: application/json' \
  -d '{"rules":[{"endpoint":"checkout","status":500,"when":"after","times":1}]}'
```

## Booking endpoints (Task 3)

Under `/api/booking`, because `/api/providers` already serves Task 1. Seeded from `data/task3-booking.json`; bookings are held in memory and reset with `POST /api/__mock/reset`.

When the server starts, every `dayOffset` becomes a date on that provider's own calendar (day 0 is today *there*). Providers are returned exactly as stored, messy `timezone` values included; the server reads them with the same code the client uses (`../shared`). All dates are `YYYY-MM-DD` and all times `HH:MM` on the provider's clock.

| Method | Path | Mock rule endpoint | Responses |
| --- | --- | --- | --- |
| GET | `/providers` | `bookingProviders` | 200 raw providers |
| GET | `/providers/:id` | `bookingProvider` | 200 raw provider with specialists, 404 |
| GET | `/providers/:id/availability?specialistId=&numberOfPeople=&rescheduling=` | `availability` | 200 `{ today, days: [{ date, status, … }] }` for the 90-day window |
| GET | `/providers/:id/slots?date=&specialistId=&rescheduling=` | `slots` | 200 `{ date, slots: [{ startTime, endTime, isBooked }] }`, 400 `date_out_of_range` |
| POST | `/bookings` `{ providerId, specialistId, date, startTime, numberOfPeople, idempotencyKey? }` | `createBooking` | 201 `{ bookingId }`, 409 |
| GET | `/bookings/:id` | `getBooking` | 200 booking, 404 |
| PUT | `/bookings/:id` `{ date, startTime }` | `updateBooking` | 200 booking, 409 |

The availability endpoint isn't in the brief. Without it the calendar would need 90 slot requests to show which days can be booked and why. A day's `status` is one of `available` (with `availableStartTimes`), `past`, `outside-window`, `closure` (with the provider's `reason`), `closed`, `specialist-unavailable` (with `opensAt`/`closesAt` when the opening hours cut the specialist's hours), `fully-booked`, `no-time-left` or `not-enough-in-a-row`.

`rescheduling=<bookingId>` counts that booking's own slots as free, so a booking can move to a time that overlaps where it is now.

**Conflicts.** A 409 is `slot_taken` (someone else holds one of the slots) or `slot_unavailable` (the time can't be booked: started, closed, off the slot grid, or not enough slots in a row for the group). Both carry `details.alternatives`: up to 3 bookable start times nearest to the one asked for, up to 3 days either side.

**Group bookings** hold one slot per person, one after another with the same specialist. **Idempotency:** a POST with an `idempotencyKey` it has seen before returns the same booking; the same key for a different booking is a 409 `idempotency_key_reused`. A PUT is safe to repeat as it is.

```bash
# Someone else takes the slot first on the next booking
curl -X PUT localhost:3001/api/__mock/config -H 'content-type: application/json' \
  -d '{"rules":[{"endpoint":"createBooking","when":"raced","times":1}]}'

# The booking is made but the response is lost
curl -X PUT localhost:3001/api/__mock/config -H 'content-type: application/json' \
  -d '{"rules":[{"endpoint":"createBooking","status":0,"when":"after","times":1}]}'
```

The query flags work here too, with the resource name `booking` (`?mockDelay=3000`, `?mockFail=booking`).
