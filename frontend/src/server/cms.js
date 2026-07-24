/**
 * Server-side CMS / Prepr wiring (Node / Express).
 *
 * The Vue mirror of `propeller-next`'s proxy.ts Prepr bridge + preview routes.
 * All of this is gated on Prepr being the active CMS (`CMS_PROVIDER=prepr`);
 * for Strapi / none it is inert, so a non-Prepr shop behaves exactly as before.
 *
 * Authored as plain `.js` ESM so `server.js` can `import` it directly — unlike
 * `src/*.ts` modules, `server.js`'s static imports are NOT run through Vite's
 * transform, so they can't use TypeScript or `import.meta.env`.
 *
 * Server-only. Never imported by a client component.
 */

import crypto from 'node:crypto'

const PREPR_UID_COOKIE = '__prepr_uid'
const SEGMENTS_COOKIE = 'prepr-segments'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

/** True when Prepr is the active CMS. Gates the whole Prepr bridge. */
export function isPreprEnabled() {
  return (process.env.CMS_PROVIDER || process.env.VITE_CMS_PROVIDER || '').trim().toLowerCase() === 'prepr'
}

/** Shared secret guarding the preview route. */
export function previewSecret() {
  return process.env.PREPR_PREVIEW_SECRET || 'prepr-preview'
}

/**
 * Resolve the Prepr personalization signals for an incoming request:
 *  - a stable visitor id (`__prepr_uid`, minted if absent — same cookie the
 *    tracking pixel uses, so tracked visitor === personalized visitor),
 *  - the Prepr-* headers to forward to the CMS fetch (Customer-Id, Segments,
 *    Visitor-IP, Context-* from UTMs, ABTesting),
 *  - whether the uid was freshly minted (so the caller persists the cookie).
 *
 * The editor preview bar appends `?prepr_preview_segment` / `?prepr_preview_ab`;
 * a targeted segment overrides the cookie (Prepr prioritizes Customer-Id over
 * Segments, so when a segment is targeted we still send it and let it win).
 *
 * Returns `{ headers: {}, uid: null, isNew: false }` when Prepr is disabled.
 */
export function resolvePreprRequest(req) {
  if (!isPreprEnabled()) return { headers: {}, uid: null, isNew: false }

  const cookies = parseCookieHeader(req.headers.cookie || '')
  const existing = cookies[PREPR_UID_COOKIE]
  const uid = existing || crypto.randomUUID()

  const headers = {}
  headers['prepr-customer-id'] = uid

  const query = req.query || {}
  const previewSegment = firstStr(query.prepr_preview_segment)
  const previewAb = firstStr(query.prepr_preview_ab)

  const segments = previewSegment || cookies[SEGMENTS_COOKIE]
  if (segments) {
    const sorted = segments
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
      .join(',')
    if (sorted) headers['prepr-segments'] = sorted
  }
  if (previewAb) headers['prepr-abtesting'] = previewAb

  const ip =
    firstStr(req.headers['cf-connecting-ip']) ||
    (firstStr(req.headers['x-forwarded-for']) || '').split(',')[0].trim()
  if (ip) headers['prepr-visitor-ip'] = ip

  for (const key of UTM_KEYS) {
    const value = firstStr(query[key])
    if (value) headers[`prepr-context-${key}`] = value
  }

  return { headers, uid, isNew: !existing }
}

/** Cookie options for persisting a freshly-minted visitor id (1 year). */
export function preprUidCookie(uid) {
  return {
    name: PREPR_UID_COOKIE,
    value: uid,
    options: { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax' },
  }
}

// ── helpers ──

function firstStr(v) {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
  return typeof v === 'string' ? v : ''
}

function parseCookieHeader(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    if (name) out[name] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}
