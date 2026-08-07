# Changelog

All notable changes to the propeller-vue boilerplate are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
