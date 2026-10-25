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
