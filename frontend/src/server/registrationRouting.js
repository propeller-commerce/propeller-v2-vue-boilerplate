import { createHash } from 'node:crypto'
import { print } from 'graphql'
import { signCookie, verifyCookie } from './signedCookie.js'
import { createRateLimiter, formLimiter } from './rateLimit.js'

/**
 * Self-registration (#12). The package RegisterForm (vue-ui useAuth.registerContact)
 * runs `companyCreate` from the browser, then `contactRegister`, then one
 * `companyAddressCreate` per address type under the new session. A storefront key
 * limited to its role may not run the company steps, so the proxy sends exactly the
 * SDK's own documents with the order-editor key and without a Bearer:
 * - `companyCreate` for anonymous callers only, rate-limited per IP and in total,
 *   `input` reduced to the registration fields;
 * - `companyAddressCreate` only for the company this browser just created (signed
 *   httpOnly cookie, 15 minutes), once per address type.
 */

// sha256 of print(parse(document)) of the installed SDK's documents; the test fails
// after an SDK upgrade that changes them, until these are updated.
export const REGISTRATION_DOCUMENT_HASHES = {
  companyCreate: 'f63fd68ed60135a104ba16755c22692403334038292e6861d9a0eaedd17d89ae',
  companyAddressCreate: 'b4dd23230e005aaa5ebd462f6f59b89cbb06ed4a8b1b1cad870ab27f2687fe1b',
}

export const REGISTRATION_COOKIE = 'propeller_registration'
export const REGISTRATION_MAX_AGE = 15 * 60
const REGISTRATION_PURPOSE = 'registration'
const ADDRESS_FLAG = { invoice: 'i', delivery: 'd' }

// Each companyCreate creates a company in Propeller: 5 per IP and 30 in total per hour.
export const REGISTRATION_LIMITS = {
  perIp: { limit: 5, windowMs: 60 * 60 * 1000 },
  total: { limit: 30, windowMs: 60 * 60 * 1000 },
}
// Kept apart from the per-IP buckets, so a flood of IPs can't push the total out.
const totalLimiter = createRateLimiter()

// The fields RegisterForm sends; anything else (debtorId, parentId, …) could tie the
// new company to an existing one.
const COMPANY_INPUT_FIELDS = new Set(['name', 'taxNumber', 'cocNumber', 'email', 'phone'])

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

/** sha256 of the normalized (printed) document. */
export function documentHash(doc) {
  return createHash('sha256').update(print(doc)).digest('hex')
}

/**
 * `{ kind: 'company' }`, `{ kind: 'address', companyId, flag }` or null.
 * ctx: { isAnonymous, registration: { companyId, used } | null } (from verifyRegistration).
 */
export function registrationStep(doc, single, variables, { isAnonymous = false, registration = null } = {}) {
  const field = single?.node.name.value
  if (field !== 'companyCreate' && field !== 'companyAddressCreate') return null
  const hash = documentHash(doc)
  if (field === 'companyCreate' && hash === REGISTRATION_DOCUMENT_HASHES.companyCreate) {
    return isAnonymous ? { kind: 'company' } : null
  }
  if (field === 'companyAddressCreate' && hash === REGISTRATION_DOCUMENT_HASHES.companyAddressCreate && registration) {
    const input = isRecord(variables) && isRecord(variables.input) ? variables.input : null
    const flag = typeof input?.type === 'string' ? ADDRESS_FLAG[input.type] : undefined
    if (!flag || input.companyId !== registration.companyId || registration.used.includes(flag)) return null
    return { kind: 'address', companyId: registration.companyId, flag }
  }
  return null
}

/** Variables for an elevated companyCreate, with `input` reduced to the registration fields. */
export function companyCreateVariables(variables) {
  const vars = isRecord(variables) ? variables : {}
  const input = isRecord(vars.input) ? vars.input : {}
  return { ...vars, input: Object.fromEntries(Object.entries(input).filter(([k]) => COMPANY_INPUT_FIELDS.has(k))) }
}

/** Seconds to wait when this IP, or registration as a whole, is over its limit; else 0. */
export function registrationLimited(ip, { perIp = formLimiter, total = totalLimiter } = {}) {
  const own = perIp.hit(`registration-company:${ip}`, REGISTRATION_LIMITS.perIp.limit, REGISTRATION_LIMITS.perIp.windowMs)
  if (!own.ok) return own.retryAfter
  const all = total.hit('registration-company', REGISTRATION_LIMITS.total.limit, REGISTRATION_LIMITS.total.windowMs)
  return all.ok ? 0 : all.retryAfter
}

/** The new company id from a companyCreate response, else null. */
export function createdCompanyId(json) {
  const id = json?.data?.companyCreate?.companyId
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Signed cookie value naming the company this browser just registered and the addresses created. */
export function signRegistration(companyId, used = '') {
  return signCookie(REGISTRATION_PURPOSE, used ? `${companyId}.${used}` : String(companyId), REGISTRATION_MAX_AGE)
}

/** `{ companyId, used }` from a valid registration cookie, else null. */
export function verifyRegistration(cookie) {
  const value = verifyCookie(REGISTRATION_PURPOSE, cookie)
  const match = value === null ? null : /^([1-9]\d{0,15})(?:\.([id]{1,2}))?$/.exec(value)
  return match ? { companyId: Number(match[1]), used: match[2] ?? '' } : null
}
