import { Enums } from 'propeller-sdk-v2'
import type { Category, Cluster, Product } from 'propeller-sdk-v2'

export const imageSearchFiltersGrid = { page: 1, offset: 1 }

export const imageVariantFiltersSmall = {
  transformations: [{ name: 'thumb', transformation: { format: Enums.Format.WEBP, height: 100, width: 100, fit: Enums.Fit.BOUNDS } }],
}

export const imageVariantFiltersMedium = {
  transformations: [{ name: 'grid', transformation: { format: Enums.Format.WEBP, height: 300, width: 300, fit: Enums.Fit.BOUNDS } }],
}

export const imageVariantFiltersLarge = {
  transformations: [{ name: 'large', transformation: { format: Enums.Format.WEBP, height: 800, width: 800, fit: Enums.Fit.BOUNDS } }],
}

const URL_PATTERN = import.meta.env.VITE_URL_PATTERN || 'page/id/slug'

function buildEntityUrl(page: string, id?: number | string, slug?: string, pattern?: string, language?: string): string {
  const p = pattern || URL_PATTERN
  const prefix = language && language.toUpperCase() !== (import.meta.env.VITE_DEFAULT_LANGUAGE || 'NL').toUpperCase()
    ? `/${language.toLowerCase()}` : ''
  const parts: string[] = []
  p.split('/').forEach(token => {
    if (token === 'page') parts.push(page)
    else if (token === 'id' && id) parts.push(String(id))
    else if (token === 'slug' && slug) parts.push(slug)
  })
  return `${prefix}/${parts.join('/')}`
}

export const baseCategoryId = parseInt(import.meta.env.VITE_BASE_CATEGORY_ID || '17', 10)
export const menuDepth = parseInt(import.meta.env.VITE_MENU_DEPTH || '3', 10)
export const channelId = parseInt(import.meta.env.VITE_CHANNEL_ID || '1', 10)

export function localizeHref(path: string, language?: string): string {
  const defaultLang = (import.meta.env.VITE_DEFAULT_LANGUAGE || 'NL').toUpperCase()
  if (!language || language.toUpperCase() === defaultLang) return path
  return `/${language.toLowerCase()}${path}`
}

export const configuration = {
  imageSearchFiltersGrid,
  imageVariantFiltersSmall,
  imageVariantFiltersMedium,
  imageVariantFiltersLarge,
  urlPattern: URL_PATTERN,
  taxZone: 'NL',
  baseCategoryId,
  menuDepth,
  urls: {
    getProductUrl(product: Product, language?: string): string {
      const slug = (language && product?.slugs?.find((s: any) => s.language === language)?.value) || product?.slugs?.[0]?.value || ''
      return buildEntityUrl('product', product?.productId, slug, URL_PATTERN, language)
    },
    getClusterUrl(cluster: Cluster, language?: string): string {
      const slugs = cluster?.slugs || (cluster as any)?.defaultProduct?.slugs
      const slug = (language && slugs?.find((s: any) => s.language === language)?.value) || slugs?.[0]?.value || ''
      return buildEntityUrl('cluster', cluster?.clusterId, slug, URL_PATTERN, language)
    },
    getCategoryUrl(category: Category, language?: string): string {
      const slug = (language && category?.slug?.find((s: any) => s.language === language)?.value) || category?.slug?.[0]?.value || ''
      return buildEntityUrl('category', category?.categoryId, slug, URL_PATTERN, language)
    },
  },
}
