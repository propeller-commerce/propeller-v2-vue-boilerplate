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

<!-- chore: trigger a fresh CI build so the Mollie VITE_* build-time vars are baked into the bundle -->

## PunchOut (OCI + cXML)

B2B e-procurement PunchOut, built on magic-token login and powered by
[`@propeller-commerce/propeller-v2-punchout`](https://www.npmjs.com/package/@propeller-commerce/propeller-v2-punchout)
(the pure protocol logic). A buyer punches out from their ERP (SAP Ariba, Coupa,
SAP OCI), shops in a live session, and transfers the cart back as a requisition.

**Wiring (Express routes in `server.js` that call the package):**

| Concern | File |
|---|---|
| cXML `PunchOutSetupRequest` | `POST /api/punchout/cxml/setup` (`server.js`) |
| Entry → session cookie → magic-login | `GET /api/punchout/enter` (`server.js`) |
| Cart transfer | `POST /api/punchout/transfer` (`server.js`) |
| Server glue + **field-mapping overrides** | `src/server/punchout.js` |
| Cart-page transfer button | `src/views/CartView.vue` |

**How it works**

- **cXML**: the buyer's system POSTs a `PunchOutSetupRequest` to
  `/api/punchout/cxml/setup`. The route reads the candidate contacts from
  `CXML_CONTACT_ID`, compares each one's `CXML_SHARED_SECRET` contact track
  attribute to the request's shared secret, mints a **one-time, 1-hour** magic
  token with the order-editor key, and returns a `PunchOutSetupResponse` whose
  StartPage is `/api/punchout/enter`.
- **OCI**: no handshake — the ERP opens
  `/api/punchout/enter?mode=oci&mtoken=…&HOOK_URL=…` directly.
- `enter` stores an httpOnly `punchout` cookie (survives magic-login's session
  clear) and redirects to `/magic-login`. The cart page then shows **Transfer
  cart to procurement** → `/api/punchout/transfer`, which builds the OCI
  `NEW_ITEM-*` set / cXML `PunchOutOrderMessage` and hands it back to the ERP.

**Environment** — `PUNCHOUT_ENABLED=true`, `CXML_CONTACT_ID=<csv of buyer
contact ids>`, `PUNCHOUT_DEBUG=true|false`, optional `PUNCHOUT_CURRENCY` /
`PUNCHOUT_TRANSFER_TARGET`. Output fields are overridable in
`PUNCHOUT_CONFIG.ociMapping` / `cxmlMapping` in `src/server/punchout.js` (deep-
merged over the package defaults; `null` drops a field) — see the package README
for the rule shape.

**Local testing** — with debug on, POST the setup request (`curl -X POST
http://localhost:4000/api/punchout/cxml/setup -H 'Content-Type: application/xml'
--data-binary @SetupRequest.xml`) and open the returned StartPage URL, or open
`/api/punchout/enter?mode=oci&mtoken=…&HOOK_URL=…` for OCI. Debug mode renders a
readable preview and keeps the cart re-runnable; the magic token is one-time, so
re-POST the setup for a fresh StartPage.

