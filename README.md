# BiManage — web app

Frontend for **BiManage**, BiTechTeam Limited's all-in-one business platform: inventory, sales and
invoices, projects and team roles, online store, BiSupplyNet wholesale network, FELI AI, support.

- **Production:** https://bimanage-frontend.vercel.app (deployed from `main`)
- **Backend API:** `https://bimanage-backend.onrender.com/api`, with Swagger at `/api/docs` (repo `itechteam3/bimanage-backend`)

## Stack

- React 18 + TypeScript, built with Vite
- Tailwind CSS v4, styled only through design tokens (see below)
- React Router; TanStack Query for server data; react-hook-form + zod for forms
- Tabler icons; Poppins, self-hosted
- Vitest + Testing Library

## Local setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then set the API URL (see below)
npm run dev                  # http://localhost:5173
npm test                     # unit + component tests
npm run typecheck
npm run build                # production build in dist/
```

The component gallery lives at `/ui-kit` (plus `/ui-kit/auth` and `/ui-kit/app`). Use it to compare against Figma.

### Environment variables

| Variable | Example | What it is |
|---|---|---|
| `VITE_API_BASE_URL` | `https://bimanage-backend.onrender.com/api` | API base, including `/api`. Defaults to `http://localhost:5000/api`. |
| `VITE_SOCKET_URL` | `https://bimanage-backend.onrender.com` | Server root for Socket.io and the health check. Defaults to the API URL without `/api`. |
| `VITE_BASE_PATH` | `/` | Only needed if the app is hosted under a sub-path. |

These are **public**: Vite compiles them into the JavaScript bundle. Never put secrets in them;
the frontend holds none.

To run against a local backend, start it on port 5000. In development the backend allows
`http://localhost:5173` automatically.

## Deploy (Vercel)

- **`main` → production** at https://bimanage-frontend.vercel.app.
- **Pull requests → preview deployments**, one URL per PR/commit (`bimanage-frontend-<hash>-<team>.vercel.app`).
- Build settings come from `vercel.json`: Vite, output `dist/`, and a rewrite to `index.html` so
  deep links such as `/invite/accept?token=…` and `/oauth/callback?token=…` work.
- Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` in Vercel → Project → Settings → Environment Variables,
  for both Production and Preview.

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, tests and build on pull requests and
on `main`. It doesn't deploy.

For the browser to reach the API, the backend's `CORS_ORIGINS` must include the production URL
and the preview pattern, and `CLIENT_URL` must be the production URL. See the backend README.

## Design tokens

Everything visual comes from the Figma file through **`docs/figma/design-tokens.json`**:
colours, type scale, spacing, radii, shadows, sizes, breakpoints and component specs. Each value
cites the Figma node it came from, or how often the screens use it.

- `npm run tokens` generates `src/styles/theme.css` (a Tailwind `@theme`). It also runs before `dev` and `build`.
- Tailwind's default palette, type sizes, radii and shadows are **switched off**, so only tokens
  exist. Write `bg-brand-navy`, `text-ink-muted`, `text-body-sm`, `rounded-xl`, `shadow-card`,
  `h-control-lg`. `bg-red-500` or `text-[13px]` won't compile, which is deliberate.
- A test fails if `theme.css` is out of date with the JSON.
- Light theme only; the design has no dark mode. Tokens are semantic, so one could be added.

Figma screen renders used for visual checks go in `docs/figma/<page>/`. They're large, so they aren't committed.

## The "waking the server" banner

The backend runs on Render's free plan, which **sleeps after ~15 minutes without traffic**. The
first request then takes up to about a minute while it starts. The app handles this:

- On load it pings the server so a sleeping instance starts waking straight away.
- If a request hasn't answered after **5 seconds**, a banner says *"Waking the server…"*.
  If the server can't be reached at all, it says so instead.
- **Only reads (GET) are retried**, with backoff of 2 s, 5 s and 10 s on network errors, timeouts and 502/503/504.
  Writes such as orders and payments are never retried, so nothing is submitted twice.

The code is in `src/lib/api/client.ts` and `src/components/feedback/ServerWakeBanner.tsx`.

## Plan gating and errors

`src/config/plans.ts` mirrors the backend's plan matrix and decides what the UI shows; the server
enforces it. When the API refuses because of the plan, daily credits or the FELI daily limit,
one upgrade dialog explains why, so screens don't handle those cases themselves.

Open question for BiTechTeam: should BiSupplyNet be on all plans (Product Blueprint) or Premium
only (detailed explanation, current backend)? It's a single flag in `plans.ts`.
