# propeller-vue — Claude Code Instructions

## What this project is

Vue 3 + Vite ecommerce storefront. This is the **Vue counterpart** of `d:/laragon/www/propeller-next` (Next.js/React). Both projects must stay in sync — every feature built in one must be mirrored in the other.

## Key paths

| Item | Location |
|---|---|
| Vue UI components | `src/components/propeller/` |
| Vue composables | `src/composables/` |
| Framework-portable utils & types | `src/composables/shared/utils/`, `src/composables/shared/types/` |
| Vue-reactive wrappers over shared utils | `src/composables/shared/` (e.g. `useUserIdentity.ts`, `usePagination.ts`, `useServiceFetch.ts`) |
| Pinia stores | `src/stores/` |
| SDK client + services | `src/lib/api.ts` |
| Configuration (image filters, URL builders) | `src/lib/config.ts` |
| React counterpart project | `d:/laragon/www/propeller-next` |
| React composables (reference) | `d:/laragon/www/propeller-next/composables/react/` |

## Composable import paths

Components import composables with relative paths from `src/components/propeller/`:

```typescript
import { useCart } from '../../composables/useCart';
import { useOrders } from '../../composables/useOrders';
import { useProductSearch } from '../../composables/useProductSearch';
```

Never use absolute or `@/` aliases in component composable imports — use the `../../composables/` relative path.

## Fix location rules

- **Component fixes**: ONLY in `src/components/propeller/`. Never edit build outputs.
- **Composable fixes**: `src/composables/useXxx.ts`. Mirror any composable change to the React counterpart at `d:/laragon/www/propeller-next/composables/react/useXxx.ts`.
- **When a React change happens in propeller-next**: Mirror it to the Vue composable here AND the Vue component.

## Sync with propeller-next

This project is **in sync** with `propeller-next/components/vue/` and `propeller-next/composables/vue/`. They are the source files. When changes are made here or in propeller-next, keep both in sync:

- React component changed → update Vue component
- Vue composable changed → mirror to React composable and vice versa
- New prop added → add to both Vue and React components

## Composable prop-wrapping pattern

All composables that accept `user`, `companyId`, or `language` require `Ref<T>`. Wrap props with `computed()`:

```typescript
const userRef    = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);
const langRef    = computed(() => props.language || 'NL');
```

## Environment variables

All env vars use `VITE_` prefix (not `NEXT_PUBLIC_`). Use `import.meta.env.VITE_*`. Never use `process.env.*` in Vue components — replace with `props.configuration?.language || 'NL'` or the appropriate store value.

Server-only env vars (read by `server.js` / `lib/server.ts`, never in the browser bundle):

- `SSR_GRAPHQL_ENDPOINT` / `SSR_GRAPHQL_PROXY_TARGET` — upstream API.
- `SSR_API_KEY`, `SSR_ORDER_EDITOR_API_KEY` — server-only credentials.
- `REVALIDATE_SECRET` — shared secret gating `POST /api/revalidate`. If unset the route fails closed (503).

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
