/**
 * SEO metadata resolvers — pick the best localized string for `<head>` tags.
 *
 * Catalog entities carry curated `metadata*` localized arrays plus fallback
 * content fields (`name`, `shortDescription`). These helpers resolve one
 * string for the active language, preferring the curated metadata and falling
 * back through the content fields. Mirrors `propeller-next/lib/seo.ts`.
 */
import type { LocalizedString } from 'propeller-sdk-v2'
import { stripHtml } from 'propeller-v2-vue-ui/shared'

/** Pick the value for `language` from a localized array, with a first-entry fallback. */
function pick(
  list: LocalizedString[] | undefined,
  language: string,
): string | undefined {
  if (!list?.length) return undefined
  const match = list.find((l) => l.language === language)
  return (match?.value || list[0]?.value || undefined) ?? undefined
}

/** Resolve a `<title>` — curated metadata title, else the entity name. */
export function resolveSeoTitle(
  metadataTitles: LocalizedString[] | undefined,
  fallbackName: LocalizedString[] | undefined,
  language: string,
): string | undefined {
  return pick(metadataTitles, language) ?? pick(fallbackName, language)
}

/**
 * Resolve a `<meta name="description">` — curated metadata description, else
 * the first non-empty content fallback (short/long description), HTML stripped.
 */
export function resolveSeoDescription(
  metadataDescriptions: LocalizedString[] | undefined,
  fallbacks: (LocalizedString[] | undefined)[],
  language: string,
): string | undefined {
  const curated = pick(metadataDescriptions, language)
  if (curated) return stripHtml(curated)
  for (const fb of fallbacks) {
    const value = pick(fb, language)
    if (value) return stripHtml(value)
  }
  return undefined
}

/** Resolve `<meta name="keywords">` from the curated keyword array. */
export function resolveSeoKeywords(
  metadataKeywords: LocalizedString[] | undefined,
  language: string,
): string | undefined {
  return pick(metadataKeywords, language)
}

/** Resolve a canonical URL from the curated canonical-url array. */
export function resolveCanonicalUrl(
  metadataCanonicalUrls: LocalizedString[] | undefined,
  language: string,
): string | undefined {
  return pick(metadataCanonicalUrls, language)
}
