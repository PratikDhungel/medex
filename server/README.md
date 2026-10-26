# medex — server

Minimal Node.js + Express API written in TypeScript. Data is read from JSON files in `data/`.

## Scripts

```bash
npm install
npm run dev        # run src/ with tsx, restarting on file changes
npm run build      # compile src/ to dist/ with tsc
npm start          # run the compiled build (run `npm run build` first)
npm run typecheck  # type-check without emitting
npm test           # cart, checkout and mock-rule tests (Vitest)
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
| POST   | `/api/checkout`            | `{ groupType, items: [{ lineId, quantity, wellnessPricingId? }], paymentMethod, idempotencyKey }` | 201 `{ orderId, status }`, 400, 402, 409, 500 |
| GET    | `/api/orders/:orderId`     |                                                                      | 200 order, 404                               |

Errors are `{ code, message, details? }`. Notable codes:

- `quantity_limit` (409): more than 10 of one service.
- `unavailable` (409): the provider removed the service; the line can only be deleted.
- `option_unavailable` (409): the chosen wellness duration isn't offered.
- `cart_changed` (409): the checkout items don't match the cart any more. `details.mismatches` lists each line with a reason (`not_in_cart`, `wrong_group`, `unavailable`, `quantity_changed`, `option_changed`, `price_unknown`).
- `idempotency_key_reused` (409): the key was already used for a different checkout.

**Idempotency.** The first successful checkout for a key is stored. Sending the same request with the same key again returns the same order (with its current status) and never creates another. Failed requests store nothing, so the key can be retried.

**Orders.** Checkout takes the group's lines out of the cart. Card orders start `pending` and settle to `paid` (or `failed`, see below) after a few seconds; a failed payment puts the lines back in the cart. Pay-at-clinic orders stay `pending`: the booking is made and payment happens at the visit. Insurance can only be paid by card.

### Failure injection (dev panel)

The query flags above also work here, with the resource names `cart`, `checkout` and `orders`. To fail one specific call, set rules at runtime:

| Method | Path                     | Description                                          |
| ------ | ------------------------ | ---------------------------------------------------- |
| GET    | `/api/__mock/config`     | Current rules and payment settlement                 |
| PUT    | `/api/__mock/config`     | Replace them                                         |
| POST   | `/api/__mock/reset`      | Restore the seed cart and forget all orders          |
| GET    | `/api/__mock/guest-cart` | The guest cart from the data file                    |

A rule names an `endpoint` (`getCart`, `updateLine`, `removeLine`, `mergeCart`, `checkout`, `getOrder`) and any of:

- `status`: respond with this error status; `0` drops the connection.
- `when`: `before` (default) fails without doing the work; `after` does the work and then fails, like a response lost on the way back.
- `delayMs`: extra latency.
- `match`: only requests whose body fields or route params equal these values.
- `times`: affect only this many matching requests.

`settlement` sets how card payments end: `{ "outcome": "paid" | "failed", "afterMs": 4000 }`.

```bash
# Decline the package group's next checkout, leave the others alone
curl -X PUT localhost:3001/api/__mock/config -H 'content-type: application/json' \
  -d '{"rules":[{"endpoint":"checkout","status":402,"match":{"groupType":"package"},"times":1}]}'

# Place the order but lose the response: a retry with the same key must return that order
curl -X PUT localhost:3001/api/__mock/config -H 'content-type: application/json' \
  -d '{"rules":[{"endpoint":"checkout","status":500,"when":"after","times":1}]}'
```
