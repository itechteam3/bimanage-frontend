# BiManage — web app

Frontend for **BiManage**, BiTechTeam Limited's business management platform: inventory, sales and invoices, online store, BiSupplyNet wholesale network, FELI AI, team and roles.

Live: Vercel (production on `main`, previews on pull requests) · Backend API: `https://bimanage-backend.onrender.com/api` (Swagger at `/api/docs`).

## Stack

React 18 + TypeScript + Vite, Tailwind CSS v4, React Router, TanStack Query, react-hook-form + zod, Tabler icons. Tests: Vitest + Testing Library.

## Develop

```bash
npm install
cp .env.example .env.local   # point at a local or deployed API
npm run dev                  # http://localhost:5173/
npm test
npm run build
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

**Vercel** builds and deploys: production from `main`, a preview for every pull request.
Settings come from `vercel.json` (Vite, `dist/`, SPA rewrites to `index.html` so deep
links such as `/invite/accept?token=…` and `/oauth/callback?token=…` work).

Vercel environment variables (public, compiled into the bundle — never secrets):
`VITE_API_BASE_URL`, `VITE_SOCKET_URL`.

GitHub Actions (`.github/workflows/ci.yml`) only checks: typecheck, tests and build on
pull requests and on `main`. It does not deploy.

The backend must allow the Vercel origins (`CORS_ORIGINS`, including the preview-URL
pattern) and point `CLIENT_URL` at the production URL — see the backend's DEPLOYMENT.md.

## Plan gating

`src/config/plans.ts` mirrors the backend plan matrix and decides what the UI shows;
the server enforces it. Open question for BiTechTeam: BiSupplyNet on all plans
(Product Blueprint) or Premium only (detailed explanation, current backend).
