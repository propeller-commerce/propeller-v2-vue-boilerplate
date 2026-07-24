/**
 * CMS helpers shared between the client, the SSR loaders, and the server seam.
 * Pure functions only — safe to import anywhere (no env / no fetch).
 */

/**
 * Slugs that resolve to the site home page. The home page is served at the
 * root `/`, not via the CMS catch-all. In Prepr the home page may use any of
 * these slugs (most notably the personalized `home-personalized`).
 */
export const HOME_SLUGS = ['home', 'home-personalized', 'index', 'home-generic'];

/** True when a slug (with or without a leading slash) refers to the home page. */
export function isHomeSlug(slug: string): boolean {
  const normalized = slug.replace(/^\/+/, '').toLowerCase();
  return normalized === '' || HOME_SLUGS.includes(normalized);
}

// ── Cache tags ──
// The server seam tags anonymous published CMS reads with these so a publish
// webhook (POST /api/cms-revalidate) can bust them surgically — mirroring the
// catalog's tagFor() scheme in src/lib/server.ts. Preview / personalized reads
// are never tagged (they're uncached, varying per draft/visitor).
export const TAG_CMS = 'cms';
export const cmsPageTag = (slug: string) => `cms:page:${slug}`;
export const cmsArticleTag = (slug: string) => `cms:article:${slug}`;
