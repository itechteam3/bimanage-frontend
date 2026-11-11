# BiManage — web app

Frontend for **BiManage**, BiTechTeam Limited's business management platform: inventory, sales and invoices, online store, BiSupplyNet wholesale network, FELI AI, team and roles.

Live: https://itechteam3.github.io/bimanage-frontend/ · Backend API: `https://bimanage-backend.onrender.com/api` (Swagger at `/api/docs`).

## Stack

React 18 + TypeScript + Vite, Tailwind CSS v4, React Router, TanStack Query, react-hook-form + zod, Tabler icons. Tests: Vitest + Testing Library.

## Develop

```bash
npm install
cp .env.example .env.local   # point at a local or deployed API
npm run dev                  # http://localhost:5173/bimanage-frontend/
npm test
npm run build                # also writes dist/404.html for client-side routing
```

The component gallery is at `/ui-kit` (also `/ui-kit/auth` and `/ui-kit/app`).

## Design tokens

All colours, type, spacing, radii and shadows come from the Figma file via
`docs/figma/design-tokens.json` (each value cites its Figma node or usage count).
`npm run tokens` turns it into `src/styles/theme.css`. Tailwind's default palette and
scales are switched off, so a class like `bg-red-500` doesn't exist — use tokens
(`bg-brand-navy`, `text-ink-muted`, `text-body-sm`, `rounded-xl`, `shadow-card`…).
A test fails if `theme.css` is out of date.

Figma renders used for visual checks live in `docs/figma/<page>/` and are not committed.

## Deploy

Every push to `main` runs typecheck, tests and build, then deploys to GitHub Pages
(`.github/workflows/deploy.yml`). Optional repository **variables** (not secrets — they
are public): `VITE_API_BASE_URL`, `VITE_SOCKET_URL`. The frontend holds no secrets.

Routing uses real paths (the backend emails links like `/invite/accept?token=…` and
redirects to `/oauth/callback?token=…`); `404.html` is a copy of `index.html` so deep
links work on Pages.

The backend must allow this origin: `CORS_ORIGINS=https://itechteam3.github.io` and
`CLIENT_URL=https://itechteam3.github.io/bimanage-frontend` on Render.

## Plan gating

`src/config/plans.ts` mirrors the backend plan matrix and decides what the UI shows;
the server enforces it. Open question for BiTechTeam: BiSupplyNet on all plans
(Product Blueprint) or Premium only (detailed explanation, current backend).
