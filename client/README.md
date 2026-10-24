# medex — client

React + TypeScript frontend, scaffolded with Vite. Tailwind CSS and shadcn/ui will be used for the UI.

## Scripts

```bash
npm install
npm run dev      # start dev server at http://localhost:5173
npm run build    # type-check and build to dist/
npm run lint
npm run preview  # serve the production build
```

## API

In development, requests to `/api/*` are proxied to the Express server at `http://localhost:3001` (see `vite.config.ts`), so the server must be running for data to load. Call the API with relative paths, e.g. `fetch('/api/health')`.
