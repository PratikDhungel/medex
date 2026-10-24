# medex

Full-stack app with a React frontend and a Node.js/Express backend. The two live side by side as independent projects, each with its own `package.json` and `node_modules`.

```
medex/
├── client/   # React + TypeScript + Vite, Tailwind CSS, shadcn/ui
└── server/   # Node.js + Express API (TypeScript); JSON data in server/data/
```

## Getting started

Requires Node.js 20 or newer.

Run the server and the client in two terminals:

```bash
# Terminal 1
cd server
npm install
npm run dev     # http://localhost:3001
```

```bash
# Terminal 2
cd client
npm install
npm run dev     # http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` requests to the Express server, so no CORS setup is needed in development.

See [client/README.md](client/README.md) and [server/README.md](server/README.md) for more detail.
