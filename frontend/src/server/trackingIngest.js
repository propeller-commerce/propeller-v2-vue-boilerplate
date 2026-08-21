import crypto from 'node:crypto';
import { getTrackingPool } from './tracking.js';
import { EVENT_NAME_SET } from './trackingTaxonomy.js';

/**
 * Behaviour-event ingest (PWP-910).
 *
 * Public by nature — called from the browser on every page — so everything that
 * decides WHO an event belongs to is derived server-side; the body is treated as
 * untrusted payload detail only. Without that the table fills with data
 * indistinguishable from real activity, and the first chart built on it is wrong.
 *
 * Plain `.js` for the reason given in `tracking.js`: `server.js` imports it
 * directly, bypassing Vite's transform.
 */

/** Caps. A batch that breaches them is truncated, not rejected — partial data beats none. */
const MAX_EVENTS = 50;
const MAX_BODY_BYTES = 128 * 1024;
/** How far a client clock may be off before we stop believing it. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const VISITOR_COOKIE = 'pr_vid';
const VISITOR_MAX_AGE_DAYS = 365;

const str = (v, max) => {
  if (typeof v !== 'string' || v.length === 0) return null;
  return v.length > max ? v.slice(0, max) : v;
};

const num = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const uuid = (v) => {
  const s = str(v, 36);
  return s && /^[0-9a-fA-F-]{36}$/.test(s) ? s : null;
};

const USER_MODES = new Set(['anonymous', 'b2c', 'b2b']);

/** Columns promoted out of `props`; whatever is left is stored as JSON. */
const PROMOTED = new Set([
  'page_type', 'entity_type', 'entity_id', 'entity_name',
  'search_term', 'results_count', 'query_id',
  'product_id', 'sku', 'order_id', 'quantity', 'value',
  'source',
]);

/**
 * Ingest one batch.
 *
 * Returns the visitor id in use so the route can set the cookie when it had to
 * mint one. Minting here rather than during SSR is deliberate: a `Set-Cookie` on
 * an HTML response makes that response uncacheable at a CDN, and this app has
 * real page-cache infrastructure to protect.
 */
export async function ingestBatch({ rawBody, cookieVisitorId, channelId }) {
  const pool = getTrackingPool();
  if (!pool) return { visitorId: null, minted: false, stored: 0 };

  if (typeof rawBody !== 'string' || rawBody.length > MAX_BODY_BYTES) {
    return { visitorId: cookieVisitorId ?? null, minted: false, stored: 0 };
  }

  const body = JSON.parse(rawBody);
  const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
  const ctx = body?.context ?? {};

  // Identity resolved here, never taken from the body: the channel is ours, and
  // the visitor id comes from the cookie, so a client cannot claim to be someone
  // else's visitor.
  const minted = !uuid(cookieVisitorId);
  const visitorId = uuid(cookieVisitorId) ?? crypto.randomUUID();
  if (events.length === 0) return { visitorId, minted, stored: 0 };

  const sessionId = uuid(ctx.sessionId) ?? visitorId;
  const userMode = USER_MODES.has(String(ctx.userMode)) ? String(ctx.userMode) : 'anonymous';
  const contactId = num(ctx.contactId);
  const customerId = num(ctx.customerId);
  const companyId = num(ctx.companyId);
  const language = str(ctx.language, 2);
  const currency = str(ctx.currency, 3);

  const now = Date.now();
  const rows = [];

  for (const e of events) {
    const name = str(e?.name, 64);
    // Unknown names are dropped rather than stored: an open endpoint plus a
    // free-form name column is how an events table becomes unqueryable.
    if (!name || !EVENT_NAME_SET.has(name)) continue;

    // Clamp the client clock. Every index and the partitioning are built on
    // occurred_at, so it has to be the one trustworthy axis.
    const clientTs = num(e.ts) ?? now;
    const ts = Math.abs(now - clientTs) > MAX_CLOCK_SKEW_MS ? now : clientTs;

    const props = e.props ?? {};
    const source = props.source ?? {};

    const key = str(e.key, 191) ?? `${name}:${ts}`;
    const idem = crypto.createHash('md5').update(`${visitorId}|${key}`).digest();

    const rest = {};
    for (const [k, v] of Object.entries(props)) if (!PROMOTED.has(k)) rest[k] = v;

    rows.push([
      new Date(ts), channelId, name, visitorId, sessionId, userMode,
      contactId, customerId, companyId, language, currency,
      str(props.page_type, 32), str(props.entity_type, 32), num(props.entity_id), str(props.entity_name, 255),
      str(source.type, 32), num(source.id), num(source.position),
      str(props.search_term ?? source.searchTerm, 255), num(props.results_count),
      uuid(props.query_id ?? source.queryId),
      num(props.product_id), str(props.sku, 64), num(props.order_id), num(props.quantity), num(props.value),
      idem,
      Object.keys(rest).length > 0 ? JSON.stringify(rest) : null,
    ]);
  }

  if (rows.length === 0) return { visitorId, minted, stored: 0 };

  // INSERT IGNORE, not INSERT: uq_idem means a single replayed row would
  // otherwise reject the whole batch.
  await pool.query(
    `INSERT IGNORE INTO storefront_events
       (occurred_at, channel_id, event_name, visitor_id, session_id, user_mode,
        contact_id, customer_id, company_id, language, currency,
        page_type, entity_type, entity_id, entity_name,
        source_type, source_id, source_position,
        search_term, results_count, query_id,
        product_id, sku, order_id, quantity, value,
        idempotency_key, props)
     VALUES ?`,
    [rows]
  );

  return { visitorId, minted, stored: rows.length };
}

/** `Set-Cookie` value for a freshly minted visitor id. */
export function visitorCookie(visitorId) {
  const maxAge = VISITOR_MAX_AGE_DAYS * 24 * 60 * 60;
  return `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
