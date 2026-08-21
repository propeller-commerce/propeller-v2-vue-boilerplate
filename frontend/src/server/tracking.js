/**
 * Analytics database access.
 *
 * Plain `.js` ESM on purpose, like `mollie.js` / `msp.js` / `punchout.js`:
 * `server.js` imports this directly and its static imports are NOT run through
 * Vite's transform, so nothing here may use TypeScript, `import.meta.env` or the
 * `@/` alias. Credentials come from `process.env` and never carry a `VITE_`
 * prefix, which would inline them into the client bundle.
 *
 * This file merges what propeller-next splits across `lib/tracking/dbconfig.ts`,
 * `lib/tracking/timezone.ts` and `lib/trackingDb.ts` — that split exists there so
 * the config half can be unit-tested without `server-only`, a constraint this
 * repo does not have.
 */

import mysql from 'mysql2/promise';

/**
 * How to reach the analytics database.
 *
 * Split out of `lib/trackingDb.ts` so it can be unit-tested: that module imports
 * `server-only`, which throws by design outside a bundler and so cannot be
 * loaded by `node --test`. Nothing here opens a connection.
 *
 * Three connection shapes, because "MySQL on 127.0.0.1" is a development
 * convenience rather than how this ships:
 *
 *   TRACKING_DB_URL     a platform-injected `mysql://` URL — wins when present
 *   TRACKING_DB_SOCKET  a unix socket, for a database on the same Linux host
 *   TRACKING_DB_HOST    host / port over TCP
 *
 * Reading credentials here is safe despite this file having no `server-only`
 * guard: none of these vars is `NEXT_PUBLIC_`-prefixed, so Next never inlines
 * them into a client bundle — they simply read as `undefined` in the browser.
 */
/** Read an env var, treating blank as absent — an empty var is not a value. */
const env = (key) => {
    const value = process.env[key];
    return value && value.trim() !== '' ? value.trim() : undefined;
};
/**
 * TLS profile.
 *
 * Every managed MySQL (RDS, Aiven, PlanetScale, DigitalOcean) refuses plaintext
 * connections, so without this the app can only reach a database on its own
 * host — the one deployment shape a container platform does not have.
 *
 *   true         verify against the system CA store; the correct choice
 *   skip-verify  encrypted but unauthenticated — a tunnel, not security
 *   <name>       a built-in mysql2 profile, e.g. "Amazon RDS"
 */
export function sslOption() {
    const ssl = env('TRACKING_DB_SSL');
    if (!ssl || ssl === 'false')
        return undefined;
    if (ssl === 'true')
        return {};
    if (ssl === 'skip-verify')
        return { rejectUnauthorized: false };
    return ssl;
}
/**
 * Pool options, or `null` when no database is configured.
 *
 * `null` is a supported state rather than an error: a storefront runs fine with
 * no analytics database, ingest answers 202 and reads degrade to [].
 */
export function poolOptions() {
    const common = {
        // Low on purpose: each serverless instance holds its own pool, so a high
        // limit multiplied by scale-out exhausts the server's max_connections.
        connectionLimit: Number(env('TRACKING_DB_POOL') || 4),
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        // DECIMAL/BIGINT come back as strings by default; we want numbers in JSON.
        decimalNumbers: true,
        supportBigNumbers: true,
        bigNumberStrings: false,
        timezone: 'Z',
        ssl: sslOption(),
    };
    // A URL wins: it is how every hosting platform injects a database, and
    // hand-splitting one into five vars is the step people get wrong.
    const url = env('TRACKING_DB_URL');
    if (url)
        return { uri: url, ...common };
    const database = env('TRACKING_DB_NAME');
    const socketPath = env('TRACKING_DB_SOCKET');
    const host = env('TRACKING_DB_HOST');
    if (!database || (!host && !socketPath))
        return null;
    return {
        ...common,
        // A socket beats TCP when both are set — `host` is meaningless then, and a
        // socket is the only way in when the account authenticates via auth_socket.
        ...(socketPath ? { socketPath } : { host, port: Number(env('TRACKING_DB_PORT') || 3306) }),
        user: env('TRACKING_DB_USER') || 'root',
        // Raw, not trimmed: whitespace can be part of a password.
        password: process.env.TRACKING_DB_PASSWORD ?? '',
        database,
    };
}
/** What to actually do about it. Shown verbatim in the dashboard banner. */
export const STATUS_HINTS = {
    not_configured: 'No analytics database is configured. Set TRACKING_DB_URL (or TRACKING_DB_HOST and ' +
        'TRACKING_DB_NAME) in your environment — see .env.local.example.',
    unreachable: 'The analytics database is not reachable. Check that the server is running and that ' +
        'the host, port or socket path is correct.',
    schema_missing: 'The database is reachable but the analytics schema is not installed. Run ' +
        '`npm run tracking:init` — or, if that account cannot create tables, ' +
        '`npm run tracking:init -- --print-sql` and hand the file to your DBA.',
    access_denied: 'The database refused these credentials. Check TRACKING_DB_USER / TRACKING_DB_PASSWORD ' +
        'and that the account may read this database.',
    tls: 'The TLS handshake failed. Managed databases require TRACKING_DB_SSL=true; a private ' +
        'certificate authority may need TRACKING_DB_SSL=skip-verify.',
};
/** Driver codes, grouped by the fix rather than by the layer that produced them. */
const ERROR_CODES = {
    ER_NO_SUCH_TABLE: 'schema_missing',
    ER_BAD_DB_ERROR: 'schema_missing',
    ER_BAD_FIELD_ERROR: 'schema_missing',
    ECONNREFUSED: 'unreachable',
    ENOTFOUND: 'unreachable',
    EHOSTUNREACH: 'unreachable',
    ETIMEDOUT: 'unreachable',
    ECONNRESET: 'unreachable',
    PROTOCOL_CONNECTION_LOST: 'unreachable',
    ER_ACCESS_DENIED_ERROR: 'access_denied',
    ER_DBACCESS_DENIED_ERROR: 'access_denied',
    ER_NOT_SUPPORTED_AUTH_MODE: 'access_denied',
    HANDSHAKE_SSL_ERROR: 'tls',
    SELF_SIGNED_CERT_IN_CHAIN: 'tls',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls',
    ERR_TLS_CERT_ALTNAME_INVALID: 'tls',
    EPROTO: 'tls',
};
/**
 * Classify a driver error, or `null` when it is not a setup problem.
 *
 * `null` matters as much as a match: a genuine bug in one of our queries must
 * keep surfacing as an error rather than being dressed up as a misconfiguration
 * nobody then investigates.
 */
export function classifyDbError(error) {
    const code = error?.code;
    return typeof code === 'string' ? ERROR_CODES[code] ?? null : null;
}

/**
 * Day bucketing in the shop's timezone.
 *
 * Deliberately done in Node rather than MySQL's CONVERT_TZ: that function needs
 * the server's timezone tables to be loaded, which they frequently are not — and
 * when they are missing it returns NULL rather than erroring, so a rollup
 * silently drops rows instead of failing. `Intl` ships full IANA data with the
 * runtime, so this works identically on any MySQL install.
 *
 * A fixed UTC offset is not an option: Europe/Amsterdam is +01:00 or +02:00
 * depending on DST, so a hardcoded offset is wrong for half the year and a UTC
 * bucket is wrong every night between midnight and 01:00/02:00 local.
 */
export const SHOP_TIMEZONE = process.env.TRACKING_TIMEZONE || 'Europe/Amsterdam';
/** Offset (ms) between the given instant's wall-clock time in `tz` and UTC. */
function offsetMs(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = {};
    for (const p of dtf.formatToParts(date))
        parts[p.type] = p.value;
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    return asUtc - date.getTime();
}
/**
 * The UTC instant at which the given local calendar day starts.
 *
 * Two passes because the offset itself depends on the instant: on a DST
 * boundary the first guess can land in the wrong offset, so we re-resolve.
 */
export function zonedDayStartUtc(dateStr, timeZone = SHOP_TIMEZONE) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const guess = Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0);
    const first = offsetMs(new Date(guess), timeZone);
    let ts = guess - first;
    const second = offsetMs(new Date(ts), timeZone);
    if (second !== first)
        ts = guess - second;
    return new Date(ts);
}
/** Local calendar date (YYYY-MM-DD) for an instant. */
export function zonedDateString(date, timeZone = SHOP_TIMEZONE) {
    const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return dtf.format(date);
}
export function todayLocal(timeZone = SHOP_TIMEZONE) {
    return zonedDateString(new Date(), timeZone);
}
export function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
    return dt.toISOString().slice(0, 10);
}
/**
 * Half-open [start, end) UTC range covering the local days `from`..`to`
 * inclusive. Half-open so an event at exactly midnight belongs to one day only.
 */
export function rangeToUtc(from, to, timeZone = SHOP_TIMEZONE) {
    return {
        start: zonedDayStartUtc(from, timeZone),
        end: zonedDayStartUtc(addDays(to, 1), timeZone),
    };
}


/* ── Pool ───────────────────────────────────────────────────────────────── */

let pool = null;

/** Master switch. Anything but the literal 'false' leaves the sink enabled. */
export const TRACKING_ENABLED = process.env.TRACKING_ENABLED !== 'false';

export function getTrackingPool() {
  if (!TRACKING_ENABLED) return null;
  if (pool) return pool;
  const options = poolOptions();
  if (!options) return null;
  pool = mysql.createPool(options);
  return pool;
}

/**
 * Whether a database is configured at all.
 *
 * Distinct from "a query failed": no database is an ordinary state for a shop
 * that never set analytics up, and the dashboard says so rather than rendering
 * a grid of zeros that reads as "nobody visited today".
 */
export function isTrackingConfigured() {
  return getTrackingPool() !== null;
}

/** Run a read query. Returns [] when tracking is disabled or unconfigured. */
export async function trackingQuery(sql, params = []) {
  const p = getTrackingPool();
  if (!p) return [];
  const [rows] = await p.query(sql, params);
  return rows;
}
