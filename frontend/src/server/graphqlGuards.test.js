import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import {
  hasPriceFilter,
  inspectDocument,
  isCacheableQuery,
  parseDocument,
  SDK_ALIASES,
  selectsOrderRead,
  withoutPriceFilters,
} from './graphqlGuards.js'
import { Kind, visit } from 'graphql'

const OPS = new URL('../../node_modules/@propeller-commerce/propeller-sdk-v2/dist/esm/generated/operations/', import.meta.url)

// Every document the installed SDK can send, by operation name.
async function sdkDocuments() {
  const out = []
  for (const file of readdirSync(OPS).filter((f) => f.endsWith('.js'))) {
    const { document } = await import(new URL(file, OPS).href)
    if (typeof document === 'string') out.push([file.slice(0, -3), document])
  }
  return out
}

test('parseDocument: strings that parse, else null', () => {
  assert.ok(parseDocument('{ a }'))
  assert.equal(parseDocument('{ a '), null)
  assert.equal(parseDocument(undefined), null)
  assert.equal(parseDocument({ query: '{ a }' }), null)
  assert.equal(parseDocument(`{ ${'a '.repeat(30_000)}}`), null, 'token cap')
})

test('every SDK document parses within the token cap', async () => {
  const docs = await sdkDocuments()
  assert.ok(docs.length > 100)
  for (const [name, doc] of docs) assert.ok(parseDocument(doc), name)
})

test('introspection is found anywhere; __typename is fine', () => {
  const intro = (q) => inspectDocument(parseDocument(q)).introspection
  assert.equal(intro('{ __schema { types { name } } }'), true)
  assert.equal(intro('{ products { items { t: __type(name: "Product") { name } } } }'), true)
  assert.equal(intro('query { ...F } fragment F on Query { __schema { queryType { name } } }'), true)
  assert.equal(intro('{ product(productId: 1) { __typename } }'), false)
})

test('no SDK document uses introspection', async () => {
  const offenders = (await sdkDocuments()).filter(([, doc]) => inspectDocument(parseDocument(doc)).introspection)
  assert.deepEqual(offenders.map(([n]) => n), [])
})

test('only anonymous query documents without viewer are cacheable', () => {
  const cacheable = (q) => isCacheableQuery(parseDocument(q))
  assert.equal(cacheable('fragment F on Product { productId } query p { product(productId: 1) { ...F } }'), true)
  assert.equal(cacheable('mutation m { cartStart { cartId } }'), false)
  assert.equal(cacheable('query v { viewer { __typename } }'), false)
  assert.equal(cacheable('query a { product(productId: 1) { productId } } mutation b { cartStart { cartId } }'), false)
  assert.equal(cacheable('fragment F on Product { productId }'), false)
})

test('order reads are never cached, whoever sends them', () => {
  const cacheable = (q) => isCacheableQuery(parseDocument(q))
  assert.equal(cacheable('query order($orderId: Int) { order(orderId: $orderId) { id } }'), false)
  assert.equal(cacheable('query orders($input: OrderSearchArguments) { orders(input: $input) { itemsFound } }'), false)
  assert.equal(cacheable('query orderGetPDF($orderId: Int!) { orderGetPDF(orderId: $orderId) { base64 } }'), false)
  assert.equal(cacheable('query quoteGetPDF($quoteId: Int!) { quoteGetPDF(orderId: $quoteId) { base64 } }'), false)
  assert.equal(cacheable('{ x: order(orderId: 1) { id } }'), false)
  assert.equal(cacheable('query { ...F } fragment F on Query { order(orderId: 1) { id } }'), false)
  assert.equal(cacheable('{ tender(orderId: 1) { orderId } }'), false)
  assert.equal(cacheable('{ orderAddresses(orderId: 1) { id } }'), false)
  for (const field of ['addressesByOrderId(orderId: 1)', 'shipment(id: "1")', 'shipments', 'shipmentItem(id: "1")', 'shipmentItems', 'payment(searchBy: {})', 'payments']) {
    assert.equal(cacheable(`{ ${field} { id } }`), false, field)
  }
})

test('selectsOrderRead: an order field anywhere in a query, never the checkout mutation', () => {
  const reads = (q) => selectsOrderRead(parseDocument(q))
  assert.equal(reads('{ order(orderId: 1) { id } }'), true)
  assert.equal(reads('{ x: orders(input: {}) { itemsFound } }'), true)
  assert.equal(reads('{ companies { items { order(orderId: 1) { id } } } }'), true, 'nested')
  assert.equal(reads('{ ...F } fragment F on Query { quoteGetPDF(orderId: 1) { base64 } }'), true)
  assert.equal(reads('{ x: addressesByOrderId(orderId: 1) { id } }'), true)
  assert.equal(reads('{ ...F } fragment F on Query { payments(input: {}) { itemsFound } }'), true)
  assert.equal(reads('{ products { items { productId } } shipmentItems(input: {}) { itemsFound } }'), true)
  assert.equal(reads('mutation { shipmentCreate(input: {}) { id } }'), false, 'mutations stay out')
  assert.equal(reads('{ products { items { productId } } }'), false)
  assert.equal(reads('{ products(input: { sortInputs: [{ field: NAME, order: ASC }] }) { itemsFound } }'), false)
  assert.equal(reads('mutation { cartProcess(id: "1", input: {}) { cartOrderId order { id } } }'), false)
  assert.equal(reads('mutation { a: cartProcess(id: "1", input: {}) { ...O } } fragment O on CartProcessResponse { order { id } }'), false)
})

test('of the SDK documents only the order, PDF, revision, tender, address, shipment and payment ones read orders', async () => {
  const readers = (await sdkDocuments()).filter(([, doc]) => selectsOrderRead(parseDocument(doc))).map(([n]) => n)
  assert.deepEqual(readers.sort(), [
    'order',
    'orderAddress',
    'orderAddresses',
    'orderGetPDF',
    'orderRevision',
    'orderRevisions',
    'orders',
    'payment',
    'payments',
    'quoteGetPDF',
    'shipment',
    'shipmentItem',
    'shipmentItems',
    'shipments',
    'tender',
  ])
})

const inspect = (q) => inspectDocument(parseDocument(q))

test('an alias on a cost price is found anywhere; the proxy refuses it for everyone', async () => {
  const aliased = (q) => inspect(q).costPriceAlias
  assert.equal(aliased('{ products { items { ... on Product { priceData { c: costPrices { value } } } } } }'), true)
  assert.equal(aliased('{ product(productId: 1) { inventory { balance { x: costPrice } } } }'), true)
  assert.equal(aliased('{ ...F } fragment F on Query { order(orderId: 1) { items { c: costPrice } } }'), true)
  assert.equal(aliased('{ product(productId: 1) { price { c: cost } bulkPrices { net } } }'), true)
  assert.equal(aliased('{ product(productId: 1) { priceData { costPrices { value } } } }'), false)
  const offenders = (await sdkDocuments()).filter(([, doc]) => inspectDocument(parseDocument(doc)).costPriceAlias)
  assert.deepEqual(offenders.map(([n]) => n), [])
})

test('any alias the SDK does not use is found, also inside fragments (#4)', () => {
  const foreign = (q) => inspect(q).foreignAlias
  assert.equal(foreign('{ products { items { ... on Product { p: price { gross } } } } }'), true)
  assert.equal(foreign('query { product(productId: 1) { ...F } } fragment F on Product { tiers: bulkPrices { net } }'), true)
  assert.equal(foreign('{ cart(id: "c") { t: total { g: totalGross } } }'), true)
  // Aliasing into a key hidePrices keeps: the list price under priceData.per …
  assert.equal(foreign('{ product(productId: 1) { priceData { per: list } } }'), true)
  // … or a whole page of products under a kept key.
  assert.equal(
    foreign('query { priceData: products(input: { offset: 100, page: 1, term: "" }) { per: items { ... on Product { sku price { net gross } bulkPrices { net } priceData { list costPrices { value } } } } } }'),
    true,
  )
  assert.equal(foreign('{ a: product(productId: 1) { productId } }'), true)
  assert.equal(foreign('{ categoryId: urlId }'), true)
  // The SDK's own alias, and no alias at all, are fine.
  assert.equal(foreign('{ category(categoryId: 1) { urlId: categoryId name { value } } }'), false)
  assert.equal(foreign('{ products { items { ... on Product { names { value } price { gross } } } } }'), false)
})

test('SDK_ALIASES is exactly the set of aliases the SDK documents use', async () => {
  const used = new Set()
  for (const [, document] of await sdkDocuments()) {
    visit(parseDocument(document), {
      [Kind.FIELD](node) {
        if (node.alias) used.add(`${node.alias.value}:${node.name.value}`)
      },
    })
  }
  assert.deepEqual([...used].sort(), [...SDK_ALIASES].sort())
})

test('inline price filters and PRICE sorts are found; variables and cart prices are not', () => {
  const inline = (q) => inspect(q).inlinePriceFilter
  assert.equal(inline('{ products(input: { price: { from: 76, to: 77 } }) { itemsFound } }'), true)
  assert.equal(inline('query($p: ProductPriceFilterInput) { products(input: { price: $p }) { itemsFound } }'), true)
  assert.equal(inline('{ products(input: { sortInputs: [{ field: PRICE, order: ASC }] }) { itemsFound } }'), true)
  assert.equal(inline('query($f: ProductSortField!) { products(input: { sortInputs: [{ field: $f, order: ASC }] }) { itemsFound } }'), true)
  assert.equal(inline('mutation { cartAddItem(id: "c", input: { productId: 1, price: 5 }) { cartId } }'), false)
  assert.equal(inline('query q($input: ProductSearchInput) { products(input: $input) { itemsFound } }'), false)
})

test('price filters and PRICE sorts are found in variables and removed from them', () => {
  const vars = { input: { term: 'x', price: { from: 76, to: 77 }, sortInputs: [{ field: 'PRICE', order: 'ASC' }, { field: 'NAME', order: 'ASC' }] } }
  assert.equal(hasPriceFilter(vars), true)
  assert.deepEqual(withoutPriceFilters(vars), { input: { term: 'x', sortInputs: [{ field: 'NAME', order: 'ASC' }] } })
  assert.equal(hasPriceFilter({ s: { field: 'PRICE', order: 'ASC' } }), true)
  assert.deepEqual(withoutPriceFilters({ s: { field: 'PRICE' }, t: 1 }), { t: 1 })
  assert.equal(hasPriceFilter({ input: { term: 'x', price: null } }), false)
  assert.equal(hasPriceFilter({ input: { productId: 1, price: 5 } }), false)
  assert.deepEqual(withoutPriceFilters({ input: { productId: 1, price: 5 } }), { input: { productId: 1, price: 5 } })
  assert.equal(hasPriceFilter(undefined), false)
})

test('no SDK document uses a foreign alias or inlines a price filter, so the shop\'s own queries are never refused', async () => {
  const offenders = (await sdkDocuments()).filter(([, doc]) => {
    const g = inspectDocument(parseDocument(doc))
    return g.foreignAlias || g.inlinePriceFilter
  })
  assert.deepEqual(offenders.map(([n]) => n), [])
})
