# Changelog

All notable changes to the propeller-vue boilerplate are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.11.7] - 2026-08-11

### Fixed

- **Quick order could add products from outside the shop's catalogue.** Both the
  row typeahead and the XLSX upload resolved codes through the flat `products`
  resolver, which ignores catalog and orderlist scoping server-side — so quick
  order surfaced products the category grid and the search preview correctly
  hid. Fixed in vue-ui 0.14.8, which routes the search through
  `category.getCategory` over a base category with `userId` / `companyId` /
  `applyOrderlists`, the same path `ProductGrid` and `SearchBar` use.
  `QuickOrderView` now passes `baseCategoryId`, preferring the menu store's
  value over the env override so it is right on a channel-driven shop. Codes
  outside the catalogue are reported as missing instead of being added.

### Changed

- `@propeller-commerce/propeller-v2-vue-ui` → `^0.14.8`.

## [1.11.6] - 2026-08-11

### Fixed

- **A free bonus item showed its list price on the order confirmation.** It
  read € 0,00 in the cart and at checkout, then reappeared at its list price on
  the confirmation page and in order details. The API models a bonus as two
  order lines — the product line at its list price, plus a sibling `incentive`
  line carrying the negative delta and pointing back via `parentOrderItemId` —
  and `OrderBonusItems` rendered only the product line. Fixed in vue-ui 0.14.7
  (via `getNettedBonusItems()` in core-ui 0.6.2), which nets each bonus against
  its incentive siblings; partial discounts keep their remainder. Order totals
  were already correct — this was display-only. Consumed here by pinning
  vue-ui `^0.14.7`.

## [1.11.5] - 2026-08-10

### Fixed

- **The last package strings that stayed English on a Dutch page.** vue-ui
  0.14.6 makes them overridable; this supplies the keys so they follow the
  language switcher.

  - `CategoryDescription` — the Read more / Read less toggle, in a new
    namespace.
  - `ProductTabs` — the same two keys, which the package forwards to
    `ProductDescription`.
  - `Machines` — the loading and empty states.
  - `RegisterForm` — the account-type validation message.
  - `AccountIconAndMenu` — the greeting, via a `{name}` placeholder so the
    translation controls word order.
  - Both authorization components — the modal close button's accessible name.

### Changed

- `@propeller-commerce/propeller-v2-vue-ui` → `^0.14.6`.
- The two dashboard card titles are capitalised.

### Known issues

- `CategoryDescription` does not truncate during SSR — `data-truncatable`
  renders `false` even for a description well over the 200-character limit, so
  the Read more toggle only appears after hydration. Pre-existing (reproduced
  on 1.11.4 without these changes) and not caused by the label wiring; the
  React boilerplates truncate correctly server-side.

## [1.11.4] - 2026-08-10

### Fixed

- **The language choice did not survive navigation.** Selecting EN re-rendered
  the current page, but any navigation reverted to Dutch. The preference lived
  in localStorage only, which the SSR render cannot read, and the router guard
  reset the store to the default on every unprefixed path. The choice is now
  mirrored into a `preferred_language` cookie, seeded server-side alongside the
  price store, and the guard syncs only from a prefixed URL — an unprefixed
  path is that request's default, not a preference.

- `routeLanguage()` in `ssrPrefetch` is the single resolver for an SSR fetch's
  language — URL prefix, else the cookie, else the default — so no call site
  restates the precedence. The menu prefetch reads the store rather than
  re-deriving from the URL.

- **Auth-flow strings stayed English on a Dutch page.** The login failure
  message needed the `invalidCredentials` label the app never supplied. The
  submit buttons on login, register and forgot-password, plus that page's
  title and success message, are package *props* rather than label keys, so
  passing `labels` alone left them English. Adds the `accountMenuTitle` key
  the package reads.

- The PunchOut cart notice and transfer button were hardcoded English; the
  machines page title and card CTA had no labels (new `Machines` namespace).

## [1.11.3] - 2026-08-10

### Fixed

- **Switching to a language with partial translations emptied the category
  menu** (PWP-927). `fetchMenu` filtered the localized fields server-side, so a
  category with no entry for that language came back with empty `names` /
  `slugs` and the mapper's fallback had nothing to fall back to — the row
  rendered with a blank label and an empty slug. Both fields are now fetched
  unfiltered and the mapper falls back to whichever translation exists.
- **The catalog root is now channel-driven on the client too** (PWP-913).
  `config.baseCategoryId` defaulted to a hardcoded `17` — correct on one tenant,
  wrong on every other. It is now the env override only (`undefined` when
  unset), `resolveBaseCategoryId()` throws rather than guessing when neither the
  env nor the channel yields a root, and `entry-server.ts` seeds the resolved id
  into `useMenuStore` so the refetch that follows a language switch uses the
  same root the server did.
- **Filter headings and the category menu stayed Dutch after switching to
  EN**, while the heading, description and product grid translated correctly.
  Three causes: the four listing views passed `labels` to `GridFilters` but
  not `language`, so it fell back to `descriptions[0]` (whichever language the
  API returned first); the SSR menu prefetch called `getAnonymousInfra()` with
  no argument, so the tree was always fetched in the default language; and the
  switcher navigates client-side, so the SSR-seeded tree survived it and
  `<Menu>` kept rendering the old language. The prefetch now takes the
  language off the request URL, and the switcher clears the tree so `<Menu>`
  falls back to its own language-aware fetch.

- `getCategoryUrl` compared slug languages with `===`, so a lowercase code
  silently fell through to the first slug. Now case-insensitive.

### Known issues

- After a language switch the URL keeps the previous language's slug (e.g.
  `/en/category/1845/vrachtwagenbanden`). The localized slug only arrives with
  the re-fetch that follows the switch. Cosmetic — the category id resolves the
  route and the page renders in the right language.

### Changed

- `@propeller-commerce/propeller-v2-vue-ui` -> `^0.14.5`.


## [1.11.2] - 2026-08-10

### Fixed

- **Cart and checkout showed the same lines on different tax bases.** With the
  header toggle on "Incl. BTW", the cart printed a line incl. VAT that checkout
  printed excl. VAT, neither labelled (PWP-923). `ItemsOverview` ignored
  `includeTax` while `CartItem` on the cart page followed it. Fixed in
  `propeller-v2-vue-ui` 0.14.4; both components now read the same
  `totalSum` / `totalSumNet` fields. No host change needed — `App.vue` already
  binds `:include-tax` on the provider.

### Changed

- `@propeller-commerce/propeller-v2-vue-ui` → `^0.14.4`.

## [1.11.1] - 2026-08-10

### Fixed

- **The order summary's total did not match its own lines, and ignored the
  payment method.** Two defects, both visible on the cart page and in the
  checkout sidebar (PWP-930):
  - The payment method's transaction costs are part of `total.totalGross` but
    had no line of their own, so a €7.25 order with €49.00 shipping printed a
    "Total excl. VAT" of €56.60. Fixed in `propeller-v2-vue-ui` 0.14.3, which
    renders a **Transaction costs** row; `src/locales/{en,nl}/CartSummary.json`
    gain the matching `transactionCosts` label.
  - Selecting a payment method at step 3 only set a local ref, so the totals
    kept showing the *previously stored* method's costs and then jumped when
    step 4 loaded. `CheckoutView.vue` now persists the method on select
    (skipping the no-op when the cart already carries it).

### Changed

- `@propeller-commerce/propeller-v2-vue-ui` → `^0.14.3`.

## [1.11.0] - 2026-08-07

### Fixed

- **The language switcher works.** Picking EN from the header changed only the
  button label: the URL it pushed, `/en`, did not match the home route. The
  route group is `/:lang(en)?` and vue-router ranks its empty home child BELOW
  the `:slug+` CMS catch-all, so `/en` resolved to cms-page with `slug=['en']`
  and no `lang` param — the navigation guard then reset the language to the
  default, the page 404'd, and content stayed Dutch. Every deeper path
  (`/en/cart`, `/en/product/...`) was always fine; only the bare prefix lost.
  The localized home now has its own route record with a required `:lang`
  param, which outranks the catch-all and preserves the param the guard reads.
  This also fixes the dropdown reporting EN as `aria-selected` while the button
  and content said NL — both derive from the route, which was the thing lying.
  (PWP-915)

- **`/api/graphql` and `/api/order-editor` are rate limited.** Both proxies
  inject an API key server-side and accepted unlimited unauthenticated
  requests — 1200 in 9.4s, all 200, no `Retry-After`, making the site an open
  relay to the upstream API. Both now enforce a per-IP rolling window
  (150/min anonymous, 300/min authenticated) and answer 429 with `Retry-After`.
  The authenticated tier is gated on a structurally valid, non-expired JWT, not
  raw cookie presence, so `access_token=x` cannot buy the higher ceiling — the
  refinement PWP-862 asks for on the Next side, applied here from the start.
  The GraphQL handler also caps request bodies at 100 KB (it buffers them in
  memory to build the cache key). Query-depth limiting is NOT ported; add it if
  the upstream starts seeing pathological nesting. (PWP-917)

- **Every page served the same `<title>`.** `index.html` carried a static
  `<title>propeller-vue</title>` ahead of the SSR head slot, and HTML uses the
  first title in a document — so unhead's real title was rendered but ignored,
  and crawlers saw one identical title for the whole catalog. The placeholder
  is gone and the default now comes from `useHead()` in `App.vue`, with a
  `%s | <site>` template. Home, terms, blog index, blog post and CMS pages set
  their own title and description; they previously set none. Configurable via
  `VITE_SITE_NAME` / `VITE_SITE_DESCRIPTION`. robots.txt and sitemap.xml remain
  unimplemented and out of scope. (PWP-918)

- **Checkout country and terms copy are localized.** The review step passed no
  `countries` list to `<CartOverview>`, so it fell back to the package's
  English names — one order showed "Netherlands" on review and "Nederland" on
  the thank-you page. `/terms-conditions` rendered a hardcoded English body
  under a translated heading; the copy moved into the `StaticPages` namespace
  in both locales. (PWP-920)

### Changed

- `@propeller-commerce/propeller-v2-vue-ui` **0.13.0 → 0.14.0** — keyboard and
  screen-reader operable checkout selectors (PWP-919) and language-aware
  product names, which is what put German names on a Dutch checkout review and
  thank-you page (PWP-920). Carries core-ui 0.6.1.

- New localized keys: `carriersLabel`, `methodsLabel`, `deliveryDateLabel`
  (accessible names for the three checkout radio groups) and the terms body
  copy, in both `en` and `nl`.


## [1.10.0] - 2026-08-04

### Added
- Anonymous user id is now derived from the channel at runtime instead of a
  hardcoded config value. `src/lib/server.ts` reads `channel(channelId)` once
  (cached) and uses its `anonymousUserId` for anonymous catalog/search price
  queries — so guest pricing follows the channel's configured account rather
  than the backend apikey default — and its `catalogRootId` as the base-category
  fallback when `VITE_BASE_CATEGORY_ID` is unset. `VITE_ANONYMOUS_USER_ID` is no
  longer read.

### Fixed
- Cluster configurator now renders options for ENUM-spanned clusters (an empty
  option list previously blocked variant selection). Arrives via the
  `propeller-v2-vue-ui` / `propeller-v2-core-ui` update.

## [1.9.0] - 2026-07-30

### Added
- OCI + cXML PunchOut (B2B e-procurement), built on magic-token login and the
  `@propeller-commerce/propeller-v2-punchout` package. Express `/api/punchout/*`
  routes handle the cXML `PunchOutSetupRequest`, the OCI/cXML session entry, and
  the cart transfer back to the ERP. Field mappings are config-driven; the cXML
  shared secret is validated against the buyer contact's `CXML_SHARED_SECRET`
  track attribute.

## [1.8.0] - 2026-07-29

### Added
- Magic-token (passwordless) login: `/magic-login?mtoken=` exchanges a
  backend/ERP-issued token for a session. Bumps `propeller-v2-vue-ui` to 0.8.0.

## [1.7.0] - 2026-07-29

### Changed
- Aligned with propeller-sdk-v2 0.14.0 (deprecated-surface removal). Bumps
  `propeller-v2-vue-ui` to 0.7.0.

## [1.6.0] - 2026-07-29

### Added
- Quick-order page + header nav entry.
- Blank optional address fields; semi-closed portal gating (prices hidden until
  login). Bumps `propeller-v2-vue-ui` to 0.6.1.

## [1.5.0] - 2026-07-24

### Added
- CMS integration (Strapi / Prepr) with a Prepr runtime provider, mirroring the
  Next boilerplate's provider model.

## [1.4.0] - 2026-07-23

### Added
- Spare-parts machines section: a contact-only browser over the company's
  installed machines. Bumps `propeller-v2-vue-ui` to 0.4.0.

## [1.3.0] - 2026-07-20

### Added
- i18n coverage across account, checkout, layout, blog and static pages; enum
  labels, pluralisation and placeholder translations (Dutch).

### Fixed
- CMS catch-all returns a branded 404 for unmatched paths.
- Listing pages ignore tracking / unknown query params.

## [1.2.0] - 2026-07-08

### Changed
- Bumped propeller-sdk-v2 to 0.12.0 and `propeller-v2-vue-ui` / mollie to match.

## [1.1.0] - 2026-06-30

### Added
- Mollie PSP payments (`@propeller-commerce/propeller-v2-mollie`): hosted
  payment page, webhook + return handling, order status resolved from the
  authoritative backend order.

### Fixed
- Gate Mollie on the cart's persisted payment method (not the local ref).

## [1.0.0] - 2026-06-10

First public release of the Vue 3 + Vite boilerplate.

### Added
- Vue 3 + Vite shop (app code in `frontend/`).
- Consumes the published Propeller Vue UI package and SDK.
- Public GitHub mirror with CI-driven releases.
