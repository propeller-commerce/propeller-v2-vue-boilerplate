/**
 * Tracking configuration.
 *
 * Resolved at BUILD time from `import.meta.env.VITE_*`, exactly like
 * `lib/preprEvent.ts`'s `PREPR_ENABLED`. That is what lets a tracking-off build
 * dead-code-eliminate the whole subscriber rather than ship it dormant.
 *
 * The propeller-nuxt twin of this file is push-based instead — Nuxt forbids
 * reading `process.env.NUXT_PUBLIC_*` in client code, so its values arrive via
 * `configureTracking()` from a plugin. Every OTHER file in this directory is
 * byte-identical between the two repos; keeping the difference confined here is
 * the point.
 *
 * Deliberately NOT importing `@/lib/config` for `baseCategoryId`, even though it
 * derives the same value from the same variable: this whole directory has to
 * stay free of path aliases so `node --test --experimental-strip-types` can load
 * it. That runner has no resolver, so one `@/` import makes every test in the
 * directory unrunnable. Duplicating a four-line env read is the cheaper half of
 * that trade.
 */

/**
 * `import.meta.env` exists only under Vite. Under the bare Node test runner it
 * is undefined, and reading `.VITE_X` off it would throw at module load.
 */
const env: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export interface TrackingConfig {
  enabled: boolean;
  ga4Enabled: boolean;
  ga4MeasurementId: string;
  gtmId: string;
  currencyCode: string;
  rootCategoryId: number | null;
}

const flag = (value: unknown): boolean => String(value ?? '').trim().toLowerCase() === 'true';

/** Env override ONLY, mirroring `@/lib/config` — a hardcoded catalog root is
 *  wrong on any shop whose root isn't that number. */
const rootCategoryId = ((): number | null => {
  const parsed = parseInt(env.VITE_BASE_CATEGORY_ID ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
})();

const state: TrackingConfig = {
  enabled: flag(env.VITE_TRACKING_ENABLED),
  ga4Enabled: flag(env.VITE_USE_GA4) && String(env.VITE_GA4_KEY ?? '').trim() !== '',
  ga4MeasurementId: String(env.VITE_GA4_KEY ?? '').trim(),
  gtmId: String(env.VITE_GTM_KEY ?? '').trim(),
  currencyCode: String(env.VITE_CURRENCY_CODE ?? 'EUR').trim() || 'EUR',
  rootCategoryId,
};

/** Present for parity with the Nuxt twin; the build-time values already stand. */
export function configureTracking(partial: Partial<TrackingConfig>): void {
  Object.assign(state, partial);
}

export function getTrackingConfig(): TrackingConfig {
  return state;
}

/**
 * A container is configured — push `{event, ecommerce}` rather than calling gtag.
 * The two transports are NOT interchangeable; see `ga4.ts`.
 */
export function isGtmMode(): boolean {
  return state.ga4Enabled && state.gtmId !== '';
}
