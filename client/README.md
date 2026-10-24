# medex — client

React + TypeScript frontend, scaffolded with Vite, styled with Tailwind CSS v4 and shadcn/ui.

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

## Styling

- **Tailwind CSS v4** is wired in through the `@tailwindcss/vite` plugin. There is no `tailwind.config.js`; theme tokens live in `src/index.css`.
- **shadcn/ui** components are in `src/components/ui/` (config in `components.json`). Add more with:

  ```bash
  npx shadcn@latest add <component>
  ```

- Import with the `@` alias, e.g. `import { Button } from '@/components/ui/button'`.

### Theme tokens

Brand values are defined once at the top of `:root` in `src/index.css`:

| Token                | Value     | Use                                    |
| -------------------- | --------- | -------------------------------------- |
| `--brand-from`       | `#e8572a` | Gradient start; also shadcn `primary`  |
| `--brand-to`         | `#ff8a4c` | Gradient end; focus ring               |
| `--brand-glow`       | `#ffb07b` | Inset glow on the primary button       |
| `--brand-foreground` | `#fdfdfd` | Text on brand backgrounds              |
| `--font-body`        | Inter     | Body text (`font-sans`)                |
| `--font-accent-family` | Poppins | Buttons and headings (`font-accent`)   |

These are exposed to Tailwind as `bg-brand-from`, `to-brand-to`, `text-brand-foreground`, `font-accent`, etc. Fonts are loaded from Google Fonts in `index.html`.

### Button variants

`default` is the brand gradient pill. Also available: `solid` (flat primary), `secondary`, `outline`, `ghost`, `link`, `destructive`; sizes `xs`, `sm`, `default`, `lg` and `icon*`.
