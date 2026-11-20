import { createHash } from 'node:crypto'

/**
 * Verified viewer behind a Bearer token, for privilege decisions in server.js
 * (price gate, contactRegister, quote acceptance, payment routes).
 *
 * Upstream accepting the token IS the signature check: a structurally valid or
 * unexpired JWT proves nothing, and Propeller answers an invalid token with 401
 * and an expired one as the anonymous `User`. So the token is looked up once,
 * the answer cached per sha256(token), bounded, shared by concurrent requests,
 * and every failure counts as anonymous (fail closed, not cached).
 */

export const VIEWER_QUERY = `query proxyViewer($pac: ContactPurchaseAuthorizationConfigSearchInput, $companies: ContactCompaniesSearchInput) {
  viewer {
    __typename
    ... on Contact {
      contactId
      company { companyId }
      companies(input: $companies) { items { companyId } }
      purchaseAuthorizationConfigs(input: $pac) { items { purchaseRole company { companyId } } }
    }
    ... on Customer { customerId }
  }
}`

const VIEWER_VARIABLES = {
  pac: { page: 1, offset: 100, purchaseRoles: ['AUTHORIZATION_MANAGER'] },
  companies: { page: 1, offset: 100 },
}

const isId = (v) => Number.isSafeInteger(v) && v > 0

/**
 * The upstream `viewer` reduced to what the gates need, or null when it is not
 * a signed-in Contact or Customer:
 *   { type: 'Contact', userId, contactId, companyId, companyIds, managerOf }
 *   { type: 'Customer', userId, customerId }
 * `userId`: the contact or customer id, as `Order.userId` of the orders it placed.
 * `companyIds`: every company the contact belongs to; `managerOf`: the
 * companies it is an AUTHORIZATION_MANAGER of.
 */
export function toViewer(raw) {
  if (raw?.__typename === 'Contact' && isId(raw.contactId)) {
    const companyId = isId(raw.company?.companyId) ? raw.company.companyId : null
    const others = (raw.companies?.items ?? []).map((c) => c?.companyId)
    const managerOf = (raw.purchaseAuthorizationConfigs?.items ?? [])
      .filter((p) => p?.purchaseRole === 'AUTHORIZATION_MANAGER')
      .map((p) => p.company?.companyId)
      .filter(isId)
    return {
      type: 'Contact',
      userId: raw.contactId,
      contactId: raw.contactId,
      companyId,
      companyIds: [...new Set([companyId, ...others].filter(isId))],
      managerOf: [...new Set(managerOf)],
    }
  }
  if (raw?.__typename === 'Customer' && isId(raw.customerId)) {
    return { type: 'Customer', userId: raw.customerId, customerId: raw.customerId }
  }
  return null
}

/** A fetcher for createViewerLookup: runs VIEWER_QUERY upstream with the token. */
export function fetchViewerFrom(endpoint, apiKey) {
  return async (token) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: VIEWER_QUERY, variables: VIEWER_VARIABLES }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`viewer lookup ${res.status}`)
    const json = await res.json()
    if (json?.errors?.length) throw new Error('viewer lookup errors')
    return json?.data?.viewer ?? null
  }
}

// `exp` of a JWT in ms, unverified (Infinity when there is none): only ever used to SHORTEN how
// long something is trusted, never as proof the token is valid.
export function tokenExpiryMs(token) {
  try {
    const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))?.exp
    return typeof exp === 'number' ? exp * 1000 : Infinity
  } catch {
    return Infinity
  }
}

/**
 * `lookup(token) → Promise<Viewer | null>`; never rejects. No token = null
 * without a request. Cached for `ttlMs` (never past the token's own `exp`).
 */
export function createViewerLookup(fetchViewer, { ttlMs = 5 * 60 * 1000, maxEntries = 1000, now = Date.now } = {}) {
  const cache = new Map()
  const inFlight = new Map()

  async function load(key, token) {
    let viewer
    try {
      viewer = toViewer(await fetchViewer(token))
    } catch {
      return null
    }
    cache.delete(key)
    cache.set(key, { viewer, expiresAt: Math.min(now() + ttlMs, tokenExpiryMs(token)) })
    // Oldest entry first in a Map: drop it once over the bound.
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value)
    return viewer
  }

  function lookup(token) {
    if (typeof token !== 'string' || !token.trim()) return Promise.resolve(null)
    const key = createHash('sha256').update(token).digest('hex')
    const hit = cache.get(key)
    if (hit && hit.expiresAt > now()) return Promise.resolve(hit.viewer)
    let pending = inFlight.get(key)
    if (!pending) {
      pending = load(key, token).finally(() => inFlight.delete(key))
      inFlight.set(key, pending)
    }
    return pending
  }
  lookup.size = () => cache.size
  return lookup
}
