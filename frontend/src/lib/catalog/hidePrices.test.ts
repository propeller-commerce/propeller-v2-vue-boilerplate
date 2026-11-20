import test from 'node:test'
import assert from 'node:assert/strict'
import { forVisitor, hidePrices, PRICE_FIELDS, pricesHidden, withoutCostPrices } from './hidePrices.ts'

const product = {
  productId: 417,
  name: [{ language: 'NL', value: 'M96 SMART' }],
  price: { list: 58, cost: 6, net: 70.18, gross: 58, discount: null },
  priceData: { per: 'ITEM', list: 58, costPrices: [{ value: 6 }], suggested: 60, store: 59, display: 'DEFAULT' },
  bulkPrices: [{ net: 65, gross: 54 }],
  surcharges: [{ id: 1, value: 2 }],
  bundles: [{ id: 3, price: { net: 100, gross: 82 }, items: [{ product: { price: { net: 1 } } }] }],
  inventory: { totalQuantity: 4 },
}

test('drops every price field and keeps the rest', () => {
  const out = hidePrices(product)
  assert.equal(out.price, null)
  assert.deepEqual(out.priceData, { per: 'ITEM', display: 'DEFAULT' })
  assert.deepEqual(out.bulkPrices, [])
  assert.deepEqual(out.surcharges, [])
  assert.equal(out.bundles[0].price, null)
  assert.equal(out.bundles[0].items[0].product.price, null)
  assert.equal(out.productId, 417)
  assert.deepEqual(out.name, product.name)
  assert.deepEqual(out.inventory, product.inventory)
})

test('kept priceData keys hold only scalars: an aliased amount or object under them is dropped (#4)', () => {
  // `priceData { per: list }` and `priceData: products(...) { per: items { … } }`
  assert.deepEqual(hidePrices({ priceData: { per: 58, display: 'DEFAULT' } }), { priceData: { per: 58, display: 'DEFAULT' } })
  const smuggled = hidePrices({
    priceData: { per: [{ sku: 'A', price: { net: 12 } }], display: { list: 58 }, defaultTaxCode: 7 },
  }) as { priceData: Record<string, unknown> }
  assert.deepEqual(smuggled.priceData, {})
  assert.equal(hidePrices({ priceData: [{ list: 58 }] }).priceData, null)
  assert.ok(!JSON.stringify(hidePrices({ x: { priceData: { per: { items: [{ price: 12 }] } } } })).includes('12'))
})

test('no price number survives anywhere in the output', () => {
  const json = JSON.stringify(hidePrices(product))
  for (const n of ['58', '70.18', '"cost"', '"suggested"', '"store"', '"gross"', '"net"']) {
    assert.equal(json.includes(n), false, n)
  }
})

test('listing min/max price and nested products are cleared', () => {
  const listing = {
    itemsFound: 2,
    minPrice: 4,
    maxPrice: 900,
    items: [{ ...product }, { clusterId: 9, defaultProduct: { ...product }, options: [{ products: [{ ...product }] }] }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = hidePrices(listing) as any
  assert.equal(out.minPrice, null)
  assert.equal(out.maxPrice, null)
  assert.equal(out.itemsFound, 2)
  assert.equal(out.items[0].price, null)
  assert.equal(out.items[1].defaultProduct.price, null)
  assert.equal(out.items[1].options[0].products[0].price, null)
})

test('does not mutate its input', () => {
  const input = structuredClone(product)
  hidePrices(input)
  assert.deepEqual(input, product)
})

test('passes through null and primitives', () => {
  assert.equal(hidePrices(null), null)
  assert.equal(hidePrices(5), 5)
})

test('cart and order amounts are cleared too (they use other field names)', () => {
  const cart = {
    cartId: 'c1',
    items: [{ productId: 1, quantity: 2, priceNet: 10, totalPrice: 24.2, totalPriceNet: 20, sum: 24.2, sumNet: 20, totalSum: 24.2, totalSumNet: 20 }],
    total: { subTotal: 24.2, subTotalNet: 20, totalNet: 20, totalGross: 24.2, discountNet: 0, tax: 4.2 },
    taxLevels: [{ taxPercentage: 21, price: 4.2 }],
  }
  const order = {
    id: 9,
    items: [{ priceTotal: 10, priceTotalNet: 8, customerPrice: 8, originalPrice: 9, costPrice: 5, originalGross: 9, originalNet: 8 }],
    total: { gross: 24.2, net: 20, discountValue: 1 },
  }
  const out = JSON.stringify([hidePrices(cart), hidePrices(order)])
  // Only ids, quantities and the tax percentage are numbers that may survive.
  const numbers = (out.match(/:\s*-?\d+(\.\d+)?/g) || []).map((m) => Number(m.slice(1)))
  assert.deepEqual(numbers.sort((a, b) => a - b), [1, 2, 9, 21])
})

test('search, discount, margin, tax-level and payment amounts are cleared; totals objects are kept', () => {
  const out = hidePrices({
    items: [{ id: 1, effectivePrice: 18.46, marginAmount: 3, saleMarginPercentage: 10, costPrices: [{ price: 2 }] }],
    total: { totalGross: 10, totalTax: 2, subTotalGross: 12, discountPercentage: 5 },
    taxPercentages: [{ percentage: 21, total: 4.2 }],
    payment: { orderId: 9, amount: 24.2 },
  })
  assert.equal(out.items[0].effectivePrice, null)
  assert.equal(out.items[0].marginAmount, null)
  assert.equal(out.items[0].saleMarginPercentage, null)
  assert.deepEqual(out.items[0].costPrices, [])
  assert.deepEqual(out.total, { totalGross: null, totalTax: null, subTotalGross: null, discountPercentage: null })
  assert.deepEqual(out.taxPercentages, [{ percentage: 21, total: null }])
  assert.deepEqual(out.payment, { orderId: 9, amount: null })
})

test('every price-like number field in the SDK types is cleared or explicitly allowed', async () => {
  const { readdirSync, readFileSync } = await import('node:fs')
  const dir = new URL('../../../node_modules/@propeller-commerce/propeller-sdk-v2/dist/cjs/type/', import.meta.url)
  // Counts, tax percentages, ids: not amounts.
  const allowed = new Set(['countTotal', 'taxPercentage', 'taxPercentageDecimal', 'totalBatches', 'totalCategories', 'totalClusters', 'totalCount', 'totalDocs', 'totalDocuments', 'totalHours', 'totalProcessed', 'totalProducts', 'totalQuantity'])
  const missing = new Set<string>()
  const files = readdirSync(dir).filter((f) => f.endsWith('.d.ts') && !f.includes('Input'))
  assert.ok(files.length > 100)
  for (const file of files) {
    const source = readFileSync(new URL(file, dir), 'utf8')
    for (const m of source.matchAll(/^\s+([a-zA-Z]*(?:[Pp]rice|[Cc]ost|[Mm]argin|[Dd]iscount|[Tt]ax|[Tt]otal|[Aa]mount|[Ss]um|[Gg]ross|[Nn]et)[a-zA-Z]*)\??: number;/gm)) {
      if (!PRICE_FIELDS.has(m[1]) && !allowed.has(m[1])) missing.add(`${file}:${m[1]}`)
    }
  }
  assert.deepEqual([...missing], [])
})

// A product as the SDK's product / products documents return it, cost prices included.
const catalogProduct = () => ({
  productId: 417,
  price: { list: 58, cost: 6, net: 70.18, gross: 58 },
  bulkPrices: [{ quantity: 10, cost: 5, net: 60 }],
  priceData: { per: 'ITEM', list: 58, costPrices: [{ value: 6, quantityFrom: 1 }], display: 'DEFAULT' },
  inventory: { totalQuantity: 3, balance: [{ warehouseId: 1, quantity: 3, costPrice: 5.5 }] },
  bundles: [{ id: 3, items: [{ product: { productId: 9, priceData: { costPrices: [{ value: 1 }] } } }] }],
})
const hasCostPrice = (data: unknown) => /"(costPrices?|cost)"/.test(JSON.stringify(data))

test('no cost price for anyone: proxy answers lose costPrice(s) for an open-shop guest and a verified viewer', () => {
  const response = { data: { products: { itemsFound: 1, items: [catalogProduct()] } } }
  // The proxy's price gate: a guest in an open shop, a verified viewer in a semi-closed one.
  for (const gated of [pricesHidden('open', false), pricesHidden('semi-closed', true), pricesHidden('closed', true)]) {
    assert.equal(gated, false)
    const out = forVisitor(response, gated)
    assert.equal(hasCostPrice(out), false)
    // Nothing else changes: the same answer with only those keys taken out.
    assert.deepEqual(out, {
      data: {
        products: {
          itemsFound: 1,
          items: [
            {
              productId: 417,
              price: { list: 58, net: 70.18, gross: 58 },
              bulkPrices: [{ quantity: 10, net: 60 }],
              priceData: { per: 'ITEM', list: 58, display: 'DEFAULT' },
              inventory: { totalQuantity: 3, balance: [{ warehouseId: 1, quantity: 3 }] },
              bundles: [{ id: 3, items: [{ product: { productId: 9, priceData: {} } }] }],
            },
          ],
        },
      },
    })
  }
  assert.equal(hasCostPrice(response), true, 'the input is not modified')
  // A gated guest gets neither cost prices nor prices.
  const gatedOut = forVisitor(response, pricesHidden('semi-closed', false))
  assert.equal(hasCostPrice(gatedOut), false)
  assert.equal(gatedOut.data.products.items[0].price, null)
})

test('no cost price in SSR product and listing results either (the fetchers shape through forVisitor)', () => {
  const product = forVisitor(catalogProduct(), false)
  assert.equal(hasCostPrice(product), false)
  assert.equal(product.priceData.list, 58)
  assert.equal(product.inventory.balance[0].quantity, 3)
  const listing = forVisitor({ itemsFound: 2, items: [catalogProduct(), catalogProduct()], minPrice: 1, maxPrice: 9 }, false)
  assert.equal(hasCostPrice(listing), false)
  assert.equal(listing.maxPrice, 9)
})

test('an order read loses costPrice at any depth; lists, errors and scalars pass through', () => {
  const order = { data: { order: { id: 9, total: { net: 12.1 }, items: [{ id: 1, price: 10, costPrice: 4, product: { productId: 5, inventory: { balance: [{ costPrice: 3 }] } } }] } } }
  assert.deepEqual(withoutCostPrices(order), { data: { order: { id: 9, total: { net: 12.1 }, items: [{ id: 1, price: 10, product: { productId: 5, inventory: { balance: [{}] } } }] } } })
  const listed = { data: { orders: { items: [{ id: 9, items: [{ costPrice: 2, quantity: 1 }] }] } }, errors: [{ message: 'x' }] }
  assert.deepEqual(withoutCostPrices(listed), { data: { orders: { items: [{ id: 9, items: [{ quantity: 1 }] }] } }, errors: [{ message: 'x' }] })
  assert.equal(withoutCostPrices(null), null)
  assert.equal(withoutCostPrices('costPrice'), 'costPrice')
})

test('prices are hidden in semi-closed and closed shops from anyone not signed in', () => {
  assert.equal(pricesHidden('open', false), false)
  assert.equal(pricesHidden('semi-closed', false), true)
  assert.equal(pricesHidden('semiclosed', false), true)
  assert.equal(pricesHidden(' Closed ', false), true)
  assert.equal(pricesHidden('closed', true), false)
  assert.equal(pricesHidden(undefined, false), false)
})

test('discount records keep no amounts for any viewer; numeric discounts stay; bulkCostPrices is dropped', () => {
  // A COST_PRICE_PLUS tier: gross and discount.value give the cost. The tier table reads quantityFrom.
  const tier = {
    discountType: 'COST_PRICE_PLUS',
    gross: 78,
    discount: { value: 30, quantityFrom: 10, validFrom: null, validTo: null, priceId: 5, product: { productId: 1 } },
  }
  assert.deepEqual(forVisitor({ product: { bulkPrices: [tier] } }, false), {
    product: { bulkPrices: [{ discountType: 'COST_PRICE_PLUS', gross: 78, discount: { quantityFrom: 10, validFrom: null, validTo: null, priceId: 5 } }] },
  })
  // Cart and order discounts are numbers, kept for a viewer who sees prices.
  const cart = { cart: { total: { discount: 5 }, items: [{ discount: 1 }] } }
  assert.deepEqual(forVisitor(cart, false), cart)
  // A root bulkCostPrices answer is dropped whole.
  assert.deepEqual(forVisitor({ data: { bulkCostPrices: { items: [{ value: 3 }] } } }, false), { data: {} })
})
