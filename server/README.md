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

| Method | Path          | Description  |
| ------ | ------------- | ------------ |
| GET    | `/api/health` | Health check |
