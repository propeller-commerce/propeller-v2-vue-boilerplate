# Changelog

All notable changes to the propeller-vue boilerplate are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
