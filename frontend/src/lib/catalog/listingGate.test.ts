import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ProductSortField, SortOrder } from '@propeller-commerce/propeller-sdk-v2'
import { listingOptionsFor } from './listingGate.ts'

const asked = {
  page: 2,
  offset: 12,
  sortField: ProductSortField.PRICE,
  sortOrder: SortOrder.ASC,
  priceFilterMin: 76.5,
  priceFilterMax: 76.6,
  textFilters: [{ name: 'colour', values: ['red'] }],
}

test('a semi-closed or closed guest gets no price range and no PRICE sort upstream (#4)', () => {
  const out = listingOptionsFor(asked, true)
  assert.equal(out.priceFilterMin, undefined)
  assert.equal(out.priceFilterMax, undefined)
  assert.equal(out.sortField, undefined) // the fetcher's default sort applies
  assert.equal(out.sortOrder, SortOrder.ASC)
  assert.equal(out.page, 2)
  assert.deepEqual(out.textFilters, asked.textFilters)
  // Other sorts are kept.
  assert.equal(listingOptionsFor({ ...asked, sortField: ProductSortField.NAME }, true).sortField, ProductSortField.NAME)
})

test('a viewer who may see prices keeps the range and the PRICE sort', () => {
  assert.deepEqual(listingOptionsFor(asked, false), asked)
})

test('sort field and order must be enum values', () => {
  const out = listingOptionsFor({ sortField: 'price' as ProductSortField, sortOrder: 'sideways' as SortOrder }, false)
  assert.equal(out.sortField, undefined)
  assert.equal(out.sortOrder, undefined)
  assert.equal(listingOptionsFor({ sortField: '__proto__' as ProductSortField }, false).sortField, undefined)
  assert.equal(listingOptionsFor({ sortOrder: SortOrder.DESC }, false).sortOrder, SortOrder.DESC)
})

test('does not mutate its input', () => {
  const copy = structuredClone(asked)
  listingOptionsFor(asked, true)
  assert.deepEqual(asked, copy)
})
