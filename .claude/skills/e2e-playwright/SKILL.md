---
name: e2e-playwright
description: Guide for running, debugging, and extending the Playwright E2E test suite for propeller-vue. Use when running tests, investigating failures, adding new test cases, or fixing Vue component bugs discovered by tests.
version: 1.0.0
tags: [playwright, e2e, testing, vue, propeller]
---

# propeller-vue — Playwright E2E Guide

## Quick start

```bash
cd D:/laragon/www/propeller-vue

# Full suite (auto-starts dev server on port 5173)
npx playwright test

# Single spec file
npx playwright test e2e/tests/anonymous/02-category.spec.ts

# Visual UI mode (recommended for debugging)
npx playwright test --ui

# One Playwright project only
npx playwright test --project=anonymous
npx playwright test --project=contact
npx playwright test --project=customer

# Auth setup only (produces storage-state/contact.json)
npx playwright test --project=setup-contact
npx playwright test --project=setup-customer

# Show last HTML report
npx playwright show-report
```

## Current test results

- **85 pass** / **32 skip** / **0 fail** (as of 2026-04-19)
- Run time: ~2.7 minutes
- 32 skips are **intentional** — AddToCart not visible on cluster products, empty order history, etc.

## Project structure

```
e2e/
  fixtures/           ← Auth setup (login → save storage-state JSON)
  helpers/            ← navigation.ts, cart.ts, auth.ts
  page-objects/       ← LoginPage, CategoryPage, ProductPage, CartPage, etc.
  storage-state/      ← contact.json, customer.json (gitignored, produced by setup)
  tests/
    anonymous/        ← 10 spec files (no auth required)
    contact/          ← 8 spec files (d.krstev@propel.us / darko000)
    customer/         ← 3 spec files (j.pardijs@propel.us / Test123123)
playwright.config.ts
```

## Auth strategy

Auth is **localStorage-based** (not cookies). Setup fixtures log in via UI, then call
`page.context().storageState({ path: 'e2e/storage-state/contact.json' })`.
Playwright loads this state for every test in the `contact` project.

**Never use `storageState` for anonymous tests** — they must test unauthenticated behavior.

## Navigation discovery

`discoverCategoryUrl(page)` and `discoverProductUrl(page)` in `e2e/helpers/navigation.ts`
discover real URLs at runtime:
1. Go to `/search/kabel` — reliable search term with results
2. Wait up to 25s for `main a[href*="/product/"]`
3. Extract leaf-category from breadcrumb (guaranteed to have products)

Use `discoverCategoryUrl` in `beforeEach` for category/product tests.

## Critical Vue bugs to watch for

### 1. Boolean prop casting (most common bug)

**Symptom:** Component renders but shows only `<!--v-if-->` comments in source. All content hidden.

**Root cause:** Vue 3 casts absent optional `boolean` props to `false`. Mitosis pattern
`v-if="showImage !== false"` fails when `showImage` is `false` instead of `undefined`.

**Fix:** Add `withDefaults` to the component's `defineProps`:

```javascript
// In <script setup>
const props = withDefaults(defineProps<MyComponentProps>(), {
  showImage: true,       // must be true if "default true"
  showName: true,
  allowAddToCart: true,
});
```

`withDefaults` is a Vue compiler macro — **no import needed**.

**Check when:** Adding a new component with optional boolean props used with `!== false` in template.

### 2. networkidle never resolves in SPA

**Symptom:** Test times out at 45s waiting for network idle.

**Fix:** Always use `waitForLoadState('domcontentloaded')`, never `networkidle`.

```typescript
// Wrong:
await page.waitForLoadState('networkidle');
// Correct:
await page.waitForLoadState('domcontentloaded');
```

### 3. AccountIconAndMenu needs `variant="sidebar"`

`AccountView.vue` must pass `variant="sidebar"` to `AccountIconAndMenu` or the Orders/Addresses/etc.
nav buttons never appear. Without it, only the icon/dropdown header variant renders.

### 4. Async product data — increase timeouts for PDP elements

Product detail page elements (title, price) load after `domcontentloaded` via async API call.
Use `{ timeout: 20_000 }` for `toBeVisible()` on `h1` and price elements.

## Adding new tests

1. Choose the correct project folder (`anonymous/`, `contact/`, `customer/`)
2. Use `discoverCategoryUrl` / `discoverProductUrl` in `beforeEach` for navigation
3. Use `domcontentloaded`, never `networkidle`
4. Use `isVisible().catch(() => false)` + `test.skip` for conditional features (e.g. "AddToCart only visible when product is simple, not cluster")
5. Page objects live in `e2e/page-objects/` — add selectors there, not inline in specs

## Fixing a failing test

1. Run `npx playwright test --ui` — visual timeline makes failures obvious
2. Or add `{ timeout: 20_000 }` to the failing assertion (async data loads late)
3. Check for boolean prop casting: look at page source for `<!--v-if-->` inside component wrappers
4. Check selector: role/text selectors are more stable than class-based
5. Check auth: contact/customer tests failing on anonymous page → setup fixture may have failed to produce storage-state JSON

## Selector strategy

No `data-testid` exist. Use role/text/label selectors:

```typescript
page.getByRole('button', { name: /add to cart/i })
page.getByLabel('Email')
page.getByRole('heading', { level: 1 })
page.locator('main')  // safe fallback — always present
```

If a selector is unstable, add `data-testid` to the component in `src/components/propeller/`.

## Skipping tests gracefully

Use the standard pattern for optional features:

```typescript
const isVisible = await element.isVisible().catch(() => false);
if (!isVisible) {
  test.skip(true, 'Feature not present in test data');
  return;
}
```

## Debugging auth issues

```bash
# Inspect saved auth state
cat e2e/storage-state/contact.json | grep -o '"auth_token":"[^"]*"'

# Re-run auth setup
npx playwright test --project=setup-contact --headed
```

## SDK service exports checklist

All views importing SDK services must find them in `src/lib/api.ts`:
- `graphqlClient` ✓
- `productService` ✓
- `cartService` ✓
- `categoryService` ✓
- `orderService` ✓
- `payMethodService` ✓

If a view imports something not in `api.ts`, add it — missing exports silently give `undefined`.
