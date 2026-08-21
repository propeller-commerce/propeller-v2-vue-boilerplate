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
- `propeller-v2-vue-ui@0.17.0+` — `onFavoriteChanged` / `onListChanged` report
  WHAT changed rather than merely that something did. Without it the favourite
  events cannot be emitted correctly: an add and a removal are indistinguishable,
  and guessing the direction is worse than not reporting at all.

<!-- chore: trigger a fresh CI build so the Mollie VITE_* build-time vars are baked into the bundle -->

## Behaviour tracking (`/tracker`) and GA4

The storefront emits its own event vocabulary on a tracking bus
(`src/lib/tracking/`, PWP-910). Two subscribers read that one stream: a batching
POST to `/api/track` (which writes MySQL) and a GA4 mapper. A tenant who wants
Segment or Snowplow instead writes a third mapper against the same events —
nothing else changes.

Mirrors propeller-next's implementation event-for-event, so reports are
comparable across all three storefronts.

| Piece | Where |
|---|---|
| Framework-free core (taxonomy, queue, GA4 item mapping) | `src/lib/tracking/{types,taxonomy,tracker,batch,items}.ts` |
| Browser facade + bootstrap | `src/lib/tracking/{bus,bootstrap,pageType}.ts` |
| Typed emit helpers | `src/lib/tracking/events.ts` |
| Ingest, metric queries, DDL | `src/server/tracking*.js` |
| Schema installer | `scripts/tracking-init.mjs` |
| Dashboard | `src/views/TrackerView.vue`, `src/components/tracker/` |

### The analytics database

**Optional.** With nothing configured the shop runs normally, `/api/track`
answers 202 and `/tracker` says which of the three setup problems it is instead
of showing empty charts.

Nothing is created automatically — not at install, not at first boot: DDL at boot
races across instances and needs production privileges the app account usually
does not have. Point the `TRACKING_DB_*` variables in `.env` at a database (see
`.env.example` for the URL / socket / TLS forms), then:

```bash
npm run tracking:init              # create the schema
npm run tracking:init -- --dry-run # report what it would do, change nothing
```

Safe to run repeatedly, so it belongs in a deploy pipeline. It detects the engine
and generates matching DDL — **MariaDB 10+, MySQL 5.6+, MySQL 8 and Cloud SQL**
all work from the one command. Where there is no native JSON type `props` becomes
`LONGTEXT`; where partitioning is disabled the table is created unpartitioned,
which costs only the `DROP PARTITION` retention shortcut.

MySQL DDL does not roll back, so the installer is **resumable** rather than
transactional: every statement is `IF NOT EXISTS` and each completed migration is
recorded in a `schema_migrations` ledger. Fix the problem, run it again, and it
continues from where it stopped. If it cannot finish — most often because the
account may not create databases, which is normal on Cloud SQL — it writes
`tracking-schema.sql` and prints the grants the account actually holds. You can
ask for that file up front from a machine with no route to the database at all:

```bash
npm run tracking:init -- --print-sql
mysql -h <host> -u <user> -p < tracking-schema.sql
```

It writes the same ledger rows the installer would, so a later `tracking:init`
**adopts** the result rather than repeating it.

### Two things worth knowing before reading a report

- **`value` is EX-VAT, with `tax` reported separately.** This SDK inverts the
  usual naming — `gross` excludes VAT and `net` includes it — so the ex-VAT
  figure is `total.gross` / `totalGross`. Matches the WordPress plugin.
- **Cart quantity edits report the delta**, not the resulting line quantity:
  raising a line 2 → 5 is `add_to_cart` with quantity 3.

### GA4 / Google Tag Manager

Off by default. With `VITE_USE_GA4=false` no script loads and no `dataLayer` is
created — and because the flag is resolved at build time, a GA4-off build
dead-code-eliminates the subscriber rather than shipping it dormant.

```ini
VITE_USE_GA4=false   # master switch
VITE_GA4_KEY=        # G-XXXXXXXXXX — required when VITE_USE_GA4=true
VITE_GTM_KEY=        # GTM-XXXXXXX — optional, and it CHANGES THE TRANSPORT
```

**The two transports are not interchangeable.** With `VITE_GTM_KEY` set we push
`{event, ecommerce}` objects, which is what a container understands; without one
we call `gtag('event', …)`, which is the only thing gtag.js understands. Sending
the wrong one fails silently.

**With a container, events only reach GA4 once a tag exists for them in GTM.**
The property will otherwise show just Google's own automatic events while the
storefront is pushing correctly. Build tags for the names in
`src/lib/tracking/taxonomy.ts` — the GA4 names are those, with `propeller.`
rewritten to `propeller_` (a dot is illegal in a GA4 event name).

Verify with `npm run test:tracking`.

### `/tracker` is ungated

**Gate it before deploying anywhere shared.** It exposes every account's
behaviour and revenue to anyone with the URL. It is `noindex` and client-only,
which is not access control. Deliberately not behind the router's `requiresAuth`
either — that would let any logged-in *customer* read it.

### Changing the schema

`src/server/trackingSchema.js` is the single source of truth. Migrations are
append-only: an id that has shipped is frozen, because installs in the field have
recorded it. Change an existing table with a new entry, never by editing an old
one — the ledger stores a checksum per migration and warns when one was applied
from different SQL than is now shipped.

The server half is plain `.js` on purpose: `server.js` imports it statically and
those imports bypass Vite entirely, so TypeScript, `import.meta.env` and `@/`
aliases are all unavailable there. That is also why `src/server/trackingTaxonomy.js`
duplicates the event allowlist — and why `taxonomy.test.ts` asserts the two copies
are identical. Drift is silent in the worst direction: the ingest drops names it
does not recognise, so an event added to one list and not the other simply never
arrives.

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

