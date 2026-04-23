# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a two-tier repo: a Vue 3 storefront under [frontend/](frontend/) plus a devbox/Taskfile deployment harness at the root. GitLab CI drives deploys; a developer working locally almost always operates inside [frontend/](frontend/).

| Path | Purpose |
|---|---|
| [frontend/](frontend/) | Vue 3 + Vite storefront (`propeller-vue`). See [frontend/CLAUDE.md](frontend/CLAUDE.md) for app-level rules. |
| [Taskfile.yml](Taskfile.yml) | go-task definitions for CI: clone source, build, rsync to deploy path, PM2 start/stop. |
| [devbox.json](devbox.json) | Wraps Taskfile targets as devbox scripts (`devbox run build-frontend-dev`, etc.). Pins `nodejs@22`, `pm2`, `rsync`, `go-task`. |
| [.gitlab-ci.yml](.gitlab-ci.yml) | 3-stage pipeline (source → build → deploy). `develop` deploys to DEV, `master` to PROD. CMS jobs are commented out — only frontend deploys today. |
| [rsync-exclude.txt](rsync-exclude.txt) | Exclusions applied when rsyncing built frontend to deploy path. |

There is no `cms/` directory in this repo despite Taskfile having `build-cms-*` / `deploy-cms-*` targets — those are scaffolded for a future Strapi CMS but inactive (CI jobs commented out, no source present).

## Frontend development commands

Run these from [frontend/](frontend/):

```bash
npm run dev          # Vite dev server on :5173 (also: `npm start`)
npm run build        # Production build (no type check)
npm run build:check  # vue-tsc -b && vite build (type-checked build)
npm run preview      # Serve the production build locally
npm run clean        # Remove dist/ (PowerShell command — Windows-only)

npm run test:e2e         # Playwright E2E suite (auto-starts dev server)
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:headed  # Run with browser visible
npm run test:e2e:report  # Open last HTML report
```

Run a single Playwright test: `npx playwright test e2e/tests/anonymous/foo.spec.ts` (or `--grep "test name"`). The config uses `webServer` with `reuseExistingServer: true`, so if `npm run dev` is already running Playwright attaches to it.

There is no lint script or unit test runner configured. `build:check` is what gates type-correctness.

## Deployment (Taskfile + devbox)

CI runs inside a devbox shell on the GitLab runner. The build job executes `task _build-frontend` which: writes `$ENV_FILE` → `.env`, `npm install`, `NODE_ENV=production npm run build`, rsyncs the whole `frontend/` tree (respecting [rsync-exclude.txt](rsync-exclude.txt)) to `/home/vueboilerplate[dev]/public_html/frontend/`. Deploy then runs `pm2 start npm -- run start --port=<APP_PORT> --host=127.0.0.1` as the deploy user.

Ports by default: PROD frontend `3000`, DEV frontend `3001` (CMS 1337/1338 reserved but unused). The Vite dev config allows hosts `vue-boilerplate.dev.wp-propel.com` and `vue-boilerplate.prod.wp-propel.com` and sets `hmr.clientPort: 80` so HMR works behind the reverse proxy fronting PM2.

Triggering a deploy: push to `develop` (→ DEV) or `master` (→ PROD). Manual recovery: SSH to the server and `devbox run start-dev` / `stop-dev` / `deploy-frontend-dev`.

## Architecture

### Stack
Vue 3 (`<script setup>` + Composition API) · TypeScript · Vite 8 · Pinia (stores) · Vue Router 4 · Tailwind 4 (via `@tailwindcss/vite`) · `propeller-sdk-v2` (GraphQL client against Propeller Commerce) · Playwright (E2E only).

### Entry and data flow
[src/main.ts](frontend/src/main.ts) creates the app, installs Pinia and the router, and rehydrates `accessToken` from `localStorage` into the shared `graphqlClient` before mount. [src/lib/api.ts](frontend/src/lib/api.ts) instantiates the single `GraphQLClient` plus `ProductService`/`CategoryService`/`CartService`/`OrderService` — **all SDK calls go through these exports**. In dev, requests are proxied through Vite's `/api/graphql` proxy which injects `apikey` server-side ([vite.config.ts:30-42](frontend/vite.config.ts#L30-L42)); in prod, `VITE_GRAPHQL_ENDPOINT` is hit directly.

### Layering
- [src/views/](frontend/src/views/) — route-level pages, one per route in [src/router/index.ts](frontend/src/router/index.ts). The `/account/*` tree is guarded by a `requiresAuth` meta + `beforeEach` hook that redirects to `/login?redirect=…`. Last route is a `:slug+` catch-all → `CmsPageView`.
- [src/components/layout/](frontend/src/components/layout/) — `AppLayout`, `AccountLayout`, `AppHeader`, `AppFooter`. Layouts are mounted as route components and render `<router-view>`.
- [src/components/propeller/](frontend/src/components/propeller/) — the storefront component library (cart, product, checkout, account UI). Components receive props like `user`/`companyId`/`language` and call composables. **Do not edit these imports to use `@/` aliases — see the import rule in [frontend/CLAUDE.md](frontend/CLAUDE.md).**
- [src/composables/](frontend/src/composables/) — `useCart`, `useOrders`, `useProductSearch`, `useAuth`, etc. Each wraps an SDK service and exposes reactive state. They take `Ref<T>` inputs (not plain values) so components wrap their props with `computed()` before passing them in.
- [src/composables/shared/](frontend/src/composables/shared/) — framework-portable logic shared with the React counterpart project:
  - `types/` — TS types (`cart.types.ts`, `orders.types.ts`, …) used by both Vue composables and the React side.
  - `utils/` — pure helpers (`userIdentity.ts`, `formatting.ts`, `attributeExtractor.ts`, …) with **no Vue reactivity**. The Vue composables (`useUserIdentity.ts`, `usePagination.ts`, `useServiceFetch.ts`) in this folder wrap these pure helpers with `computed()`/`ref()`.
- [src/stores/](frontend/src/stores/) — Pinia stores for cross-component state: `auth` (token + user), `cart` (persisted to `localStorage` via `setCart`, with `stripLeadingUnderscores` normalization), `company`, `language`, `price`.
- [src/lib/config.ts](frontend/src/lib/config.ts) — image transformation presets (WEBP thumbnails/grid/large), URL pattern builder (`buildEntityUrl`), `localizeHref` language prefixing. Most constants are driven by `VITE_*` env vars (`VITE_URL_PATTERN`, `VITE_DEFAULT_LANGUAGE`, `VITE_BASE_CATEGORY_ID`, `VITE_CHANNEL_ID`, `VITE_MENU_DEPTH`).

### Cross-framework sync (critical)
This repo is the Vue half of a two-repo pair. The React counterpart is at `d:/laragon/www/propeller-next`. Components in `src/components/propeller/` and composables in `src/composables/` are mirrored between the two projects — any change here must be mirrored there, and vice versa. See [frontend/CLAUDE.md](frontend/CLAUDE.md) for the full sync contract.

### E2E auth model
[frontend/playwright.config.ts](frontend/playwright.config.ts) defines three test personas:
- `anonymous` — no storage state.
- `contact` — depends on `setup-contact` project which logs in and writes `e2e/storage-state/contact.json`.
- `customer` — same pattern with `setup-customer` / `customer.json`.

Tests live in `e2e/tests/{anonymous,contact,customer}/`. `fullyParallel: false` and `workers: 2` — the suite is intentionally serial-ish because it hits a shared staging backend. On CI, `retries: 2` and `forbidOnly: true`.

## Environment variables

All frontend env vars use the `VITE_` prefix and are read via `import.meta.env.VITE_*`. **Never use `process.env.*` in Vue code** — the existing convention is to fall back to `props.configuration?.language || 'NL'` or the relevant Pinia store. Dev defaults live in [frontend/.env.local](frontend/.env.local); production `.env` is written by CI from `$ENV_FILE`.

Key vars: `VITE_GRAPHQL_ENDPOINT`, `VITE_API_KEY`, `VITE_ORDER_EDITOR_API_KEY`, `VITE_TIMEOUT`, `VITE_URL_PATTERN`, `VITE_DEFAULT_LANGUAGE`, `VITE_BASE_CATEGORY_ID`, `VITE_CHANNEL_ID`, `VITE_MENU_DEPTH`.
