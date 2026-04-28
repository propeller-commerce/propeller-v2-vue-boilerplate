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

## Skills available

- `/senior-architect` — architecture review and planning
- `/code-reviewer` — code quality review
- `/propeller-composable-components` — composable component patterns
