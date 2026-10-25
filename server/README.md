# medex — server

Minimal Node.js + Express API written in TypeScript. Data is read from JSON files in `data/`.

## Scripts

```bash
npm install
npm run dev        # run src/ with tsx, restarting on file changes
npm run build      # compile src/ to dist/ with tsc
npm start          # run the compiled build (run `npm run build` first)
npm run typecheck  # type-check without emitting
```

Runs on `http://localhost:3001` by default; override with the `PORT` environment variable.

## Endpoints

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
