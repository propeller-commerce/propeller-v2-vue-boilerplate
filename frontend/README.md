# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Translations

UI strings emitted by `propeller-v2-vue-ui` components are resolved through `src/lib/i18n/`. The default provider reads from `src/locales/<lang>/<Component>.json` (one JSON file per component namespace).

### Editing translations

Edit `src/locales/<lang>/<Component>.json`. Vite HMR picks up changes during `npm run dev`.

### Adding a new language

1. Create `src/locales/<new-lang>/` (lowercase ISO 639-1 code).
2. Copy `src/locales/en/*.json` into it and translate.
3. Run `npm run locales:build` to regenerate `src/locales/_registry.ts`.

### Swapping the provider

Implement the `TranslationProvider` interface (re-exported from `propeller-v2-vue-ui` — defined in `propeller-v2-core-ui`), add a case to `src/lib/i18n/index.ts`. Activate via `VITE_TRANSLATIONS_PROVIDER=<name>` in `.env`.

A provider's `getNamespace(locale, namespace)` returns `Record<string, string>` synchronously. Async sources (CMS) cache internally and expose sync once warm.

### Reading translations at call sites

```ts
import { useTranslations } from '@/lib/i18n/composable';
const labels = useTranslations('OrderList'); // ComputedRef<Record<string, string>>
```

Then in template: `<OrderList :labels="labels" ... />`. Vue auto-unwraps the `ComputedRef` at the binding. Language switches trigger automatic re-evaluation via the Pinia language store.

For SSR: `useTranslations()` works in `entry-server.ts` because the router `beforeEach` guard sets the language before any view renders.

### Reviewing seeded NL translations

`src/locales/nl/_review.md` lists slugs translated best-effort during the initial seed.

### Package version requirements

- `propeller-v2-vue-ui@0.3.3+` — adds `labels?` to several components (`UserDetails`, `OrderItemCard`, `ProductGallery`, `GridFilters`, `ProductGrid`, `GridToolbar`, `PriceToggle`), plus forwarding props on `ProductGrid` / `ProductSlider` (`productCardLabels?`, `clusterCardLabels?`, `stockLabels?`, `addToCartLabels?`, `priceLabels?`) and `loginFormLabels?` on `AccountIconAndMenu`.
- `propeller-v2-core-ui@0.2.2+` — owns the `TranslationProvider` interface (transitive via the UI package).
