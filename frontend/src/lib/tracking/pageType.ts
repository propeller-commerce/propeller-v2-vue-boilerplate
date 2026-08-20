import type { PageType } from './taxonomy';

/**
 * Route name -> page_type (PWP-910).
 *
 * Classifies on the ROUTE NAME, never the path. The names are already a clean
 * enum, so the `:lang(en)?` prefix never appears in them and the CSR shadow
 * routes are one `startsWith` away. A path regex would have to juggle
 * `/en/product/…` vs `/product/…` vs `/en/csr/product/…` and would silently
 * misclassify `cluster` as `category`.
 */

/**
 * Routes whose view emits its own richer `page_viewed` — they hold the entity
 * id and name, so letting the generic hook fire too produces two rows per view.
 */
const SELF_REPORTING = new Set([
  'category',
  'product',
  'cluster',
  'search',
  'cart',
  'checkout',
  'order-confirmation',
]);

const BY_NAME: Record<string, PageType> = {
  home: 'home',
  'home-localized': 'home',
  login: 'login',
  'magic-login': 'login',
  'forgot-password': 'login',
  register: 'register',
  machines: 'machines',
  'quick-order': 'quick_order',
  blog: 'blog',
  'blog-post': 'blog',
  'cms-page': 'cms',
  terms: 'cms',
  'authorization-request-sent': 'thank_you',
};

/** Prefix rules, longest first — `account-quotes` must beat `account`. */
const BY_PREFIX: Array<[string, PageType]> = [
  ['account-quote', 'quote'],
  ['account-favorite', 'favorites'],
  ['account', 'account'],
];

export interface PageClassification {
  pageType: PageType;
  entityId: number | null;
}

/**
 * Returns null when the route must not emit a generic `page_viewed`: the CSR
 * shadow routes (they render the same views, so the SSR twin already counted
 * the visit) and every self-reporting route.
 */
export function classifyRoute(
  name: string | null | undefined,
  params: Record<string, unknown> = {}
): PageClassification | null {
  if (!name) return null;
  // `___en` etc. — @nuxtjs/i18n suffixes route names under
  // `prefix_except_default`. Harmless here, load-bearing in the Nuxt twin.
  const route = String(name).split('___')[0];

  if (route.startsWith('csr-')) return null;
  if (SELF_REPORTING.has(route)) return null;

  const direct = BY_NAME[route];
  if (direct) return { pageType: direct, entityId: null };

  for (const [prefix, pageType] of BY_PREFIX) {
    if (route.startsWith(prefix)) {
      const id = Number(params.id ?? params.orderId ?? NaN);
      return { pageType, entityId: Number.isFinite(id) ? id : null };
    }
  }

  return { pageType: 'cms', entityId: null };
}

/** Strip the `/en` style locale prefix so paths group across languages. */
export function stripLocalePrefix(path: string): string {
  return /^\/[a-z]{2}(\/|$)/.test(path) ? path.slice(3) || '/' : path;
}
