# propeller-vue — Claude Code Instructions

## What this project is

Vue 3 + Vite ecommerce storefront under SSR (Vite SSR + a thin Node server in `server.js`). This is a **thin consumer** of the extracted `propeller-v2-vue-ui` package — components and reactive composables live there, not here. The React counterpart at `d:/laragon/www/propeller-next` is the other consumer of the same component contracts; the two projects must stay in sync.

## Key paths

| Item | Location |
|---|---|
| Vue UI components & composables | NOT here — in `propeller-v2-vue-ui` (installed from `github:propeller-commerce/propeller-v2-vue-ui#master`). Local source: `D:\laragon\www\propeller-ui\propeller-v2-vue-ui` |
| Framework-portable utils & types (kept here) | `src/composables/shared/utils/`, `src/composables/shared/types/` |
| Vue-reactive wrappers over shared utils | `src/composables/shared/` (e.g. `useUserIdentity.ts`, `usePagination.ts`, `useServiceFetch.ts`) |
| Pinia stores | `src/stores/` (`auth`, `cart`, `company`, `language`, `price`, `menu`, `ssrCatalog`) |
| SDK client + services (browser) | `src/lib/api.ts` |
| SDK client + services (SSR seam) | `src/lib/server.ts` |
| Universal app factory | `src/app.ts` (no more `main.ts` — removed in SSR migration) |
| Client / server entries | `src/entry-client.ts`, `src/entry-server.ts` |
| Node SSR server | `server.js` |
| Route SSR loaders | `src/router/ssrPrefetch.ts` |
| Configuration (image filters, URL builders) | `src/lib/config.ts` |
| SEO helpers | `src/lib/seo.ts` |
| SSR cookie/storage helpers | `src/lib/ssr.ts` |
| React counterpart project | `d:/laragon/www/propeller-next` |

## Package consumer wiring

`src/lib/api.ts` builds the browser `GraphQLClient` and a shared `services` bundle (via the package's `createServices`). `src/App.vue` wraps the host's Pinia stores in a `reactive` infra object with getters and hands it to the package via `providePropeller(infra)` — package components read `user`, `companyId`, `language`, `includeTax`, `currency`, `configuration`, `portalMode` from there. Catalog views additionally pass per-call props (`:graphqlClient`, `:user`, callbacks) when they need explicit overrides.

The package also exposes a `/shared` entry (`createServices`, `toPlain`, framework-agnostic utils/types) — `src/lib/server.ts` imports from there because it runs in Node and must not pull the Vue component tree into the SSR bundle.

## Composable import paths

Inside `propeller-vue` (views, stores), use the `@/` alias for local modules:

```typescript
import { useAuthStore } from '@/stores/auth'
import { graphqlClient } from '@/lib/api'
import { fetchProduct } from '@/lib/server'   // server-only — only from ssrPrefetch loaders
```

Components and composables come from the package:

```typescript
import { ProductGrid, providePropeller, type PropellerInfra } from 'propeller-v2-vue-ui'
import { createServices, toPlain } from 'propeller-v2-vue-ui/shared'   // SSR-safe entry
import 'propeller-v2-vue-ui/styles.css'                                // client entry only
```

## Fix location rules

- **Component / package-composable fixes**: in `propeller-v2-vue-ui` (local source: `D:\laragon\www\propeller-ui\propeller-v2-vue-ui`). Never edit `node_modules/propeller-v2-vue-ui/dist/*` build outputs.
- **Consumer-side fixes** (view layout, SSR seam, stores, routing, SEO, env wiring): here in `propeller-vue/frontend/src/`.
- **Composable changes in the package**: mirror to the React counterpart at `d:/laragon/www/propeller-next/composables/react/useXxx.ts` (or wherever the React mirror lives in that repo).
- **When a React change happens in propeller-next**: mirror it to the Vue side — usually in the package, occasionally here if it's consumer wiring.

## Sync with propeller-next

Both projects consume the same component contracts (one via the Vue package, one via the React composables in `propeller-next/composables/react/`). Keep behaviour, props, and feature set in sync — there is no codegen, the parity is manual:

- New prop added → add to both Vue and React components
- New composable behaviour → mirror across both reactive layers
- New view / route / SEO field → add to both consumers

## Composable prop-wrapping pattern

The package's composables that accept `user`, `companyId`, or `language` require `Ref<T>` inputs. When a package component is consuming them directly the package handles wrapping; when **this** project's stores/views call a package composable, wrap the value with `computed()` first:

```typescript
const userRef    = computed(() => authStore.user ?? null)
const companyRef = computed(() => companyStore.selectedCompany?.companyId)
const langRef    = computed(() => languageStore.language || 'NL')
```

## SSR architecture

Hybrid shell+islands. `server.js` runs Vite in middleware mode (dev) or serves `dist/client/` + the built `dist/server/entry-server.js` (prod). Both modes go through the same Node server — there is no `vite preview` or standalone Vite dev server anymore.

Request flow:

1. `server.js` receives the request, parses cookies, calls `entry-server.ts`'s `render(url, ctx)`.
2. `entry-server.ts` builds a **fresh** app/router/Pinia per request via `src/app.ts` (sharing a singleton across requests would leak one user's state into another's render).
3. The router resolves the URL. A matched route's `meta.ssrKey` selects a loader from `SSR_LOADERS` (see `src/router/ssrPrefetch.ts`). Loaders fetch shell data via `src/lib/server.ts` and seed Pinia stores (`useSsrCatalogStore`, `useAuthStore`).
4. An always-on parallel menu prefetch (`fetchMenu` → `useMenuStore.setTree`) runs alongside the route loader.
5. `renderToString` produces the HTML; Pinia state is serialized into `__INITIAL_STATE__`; `server.js` splices `htmlAttrs` / `bodyAttrs` / `headTags` / outlet / state script into `index.html`.
6. `entry-client.ts` restores `accessToken` from localStorage, **merges** (not replaces) `__INITIAL_STATE__` into Pinia state, then mounts. Post-mount it reconciles auth against the server (background `refreshUser`).

Hydration contract — get these wrong and you get mismatches:

- `entry-server.ts` whitelists which stores serialize into `__INITIAL_STATE__` (only `auth`, `ssrCatalog`, `menu`). Client-only stores (`cart`, `company`, `price`, `language`) are excluded so their localStorage values aren't overwritten on hydration.
- `entry-client.ts` merges keys into `pinia.state.value` instead of wholesale replacement — preserves localStorage-restored values for stores absent from the server payload.
- `ssrCatalog` uses **peek**, not consume, during the SSR + hydration ticks. `consumeSeed(path)` runs from `onMounted` so a later same-route navigation falls back to a client fetch.
- Browser-only side effects in stores (event listeners, cookie writes) MUST be `isBrowser`-gated via `src/lib/ssr.ts`. `safeStorage` is the SSR-safe `localStorage` facade.

## Environment variables

All client env vars use the `VITE_` prefix. Use `import.meta.env.VITE_*` in code that runs in the browser. Never use `process.env.*` outside `server.js` / `src/lib/server.ts` / `src/router/ssrPrefetch.ts` — anywhere else it's a build-time substitution that won't behave.

Server-only env vars (read by `server.js` / `lib/server.ts`, never in the browser bundle):

- `SSR_GRAPHQL_ENDPOINT` / `SSR_GRAPHQL_PROXY_TARGET` — upstream API.
- `SSR_API_KEY`, `SSR_ORDER_EDITOR_API_KEY` — server-only credentials.
- `REVALIDATE_SECRET` — shared secret gating `POST /api/revalidate`. If unset the route fails closed (503).

Reads in `src/lib/server.ts` go through a lazy `env()` helper (not module-level consts). Vite may evaluate that module before `server.js` has finished loading `.env*` into `process.env`; a `const` would snapshot empty.

## Caching (anonymous SSR)

Anonymous catalog GraphQL fetches go through Next.js-style per-entity tags. Logged-in users bypass via the cookie-driven dynamic gate. Mutations stay uncached.

- **Source of truth for tags:** `tagFor(entity, id?)` in `src/lib/server.ts`. Never inline `'product:42'` literals — always call `tagFor('product', 42)`.
- **Two cache layers, kept in sync by `/api/revalidate`:**
  - Parsed-object SSR cache in `src/lib/server.ts` (key: `entity:id:lang:…`, indexed by tag).
  - Raw-response LRU in `server.js`'s `/api/graphql` proxy (key: SHA-256 of POST body, indexed by tag via the `X-Propeller-Cache-Tags` header the SDK sends).
- **Cache-key keying** for the proxy LRU depends on **stable request-body byte order**. Don't reorder fields in the `build…Input` blocks of `lib/server.ts` casually.
- **Bust by tag** from `POST /api/revalidate` (header `X-Revalidate-Secret`, body `{"tag":"product:42"}`). The route invalidates BOTH layers; never bust one without the other. Pass `{"tag":"*"}` for a nuclear wipe of every cached entry.
- **Menu is pre-fetched server-side** in `entry-server.ts`'s always-on prefetch, seeded into `useMenuStore`, and passed to `<PropellerMenu :tree="...">` by `AppHeader.vue`. The package `<Menu>` skips its `useMenu` fetch when `tree` is supplied.
- **Op-type parser gotcha (`server.js`).** SDK-generated documents lead with `fragment` blocks and put `query`/`mutation` at the end. `gqlOperationType()` must scan the whole document, not just the head — otherwise every anonymous catalog read silently returns `X-Cache: BYPASS`. See memory note `project-gql-operation-type-fragment-leading`.

## Skills available

- `/senior-architect` — architecture review and planning
- `/code-reviewer` — code quality review
- `/propeller-composable-components` — composable component patterns
