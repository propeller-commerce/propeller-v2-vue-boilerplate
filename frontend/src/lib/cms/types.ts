/**
 * CMS types for the storefront.
 *
 * The canonical CMS type system + provider contract live in
 * `@propeller-commerce/propeller-v2-core-ui` (promoted from the Next
 * boilerplate). We re-export them so the app has a single import point, and add
 * the app-local extras core-ui does not yet carry:
 *
 *  - `card-actions` block (not in core-ui's `CmsTypedBlock` union yet).
 *  - Prepr-specific fetch options (`extraHeaders` / `noStore`) used by the
 *    server seam for personalization + preview; core-ui's `CmsPageOptions`
 *    only has `segments`, and `CmsFetchOptions` only `locale`/`preview`.
 */
export type {
  CmsProvider,
  CmsAdapter,
  CmsPage,
  CmsRichPage,
  CmsBlock,
  CmsTypedBlock,
  CmsImage,
  CmsSeo,
  CmsHeroBanner,
  CmsRichText,
  CmsMedia,
  CmsQuote,
  CmsValuePropItem,
  CmsValueProps,
  CmsCallToAction,
  CmsProductCarousel,
  CmsContactForm,
  CmsSlider,
  CmsProductSlider,
  CmsFeature,
  CmsFaq,
  CmsProductCard,
  CmsProductCards,
  CmsPostCards,
  CmsStatic,
  CmsArticle,
  CmsAuthor,
  CmsCategoryBanner,
  CmsNavLink,
  CmsFooterColumn,
  CmsGlobal,
  CmsPageOptions,
  CmsFetchOptions,
} from '@propeller-commerce/propeller-v2-core-ui';

import type { CmsImage } from '@propeller-commerce/propeller-v2-core-ui';

// ── App-local block: card-actions (not in core-ui's union yet) ──

export interface CmsCardActionItem {
  title: string;
  description: string | null;
  image: CmsImage | null;
  icon: CmsImage | null;
  buttonText: string | null;
  buttonUrl: string | null;
}

export interface CmsCardActions {
  _type: 'card-actions';
  title: string | null;
  items: CmsCardActionItem[];
}

// ── App-local fetch options (superset of core-ui's, for Prepr) ──

/**
 * Options threaded into a CMS page fetch. Extends core-ui's `CmsPageOptions`
 * (segments) with the Prepr personalization/preview signals the server seam
 * forwards: locale, per-request headers (Prepr-Customer-Id / Prepr-Segments /
 * Prepr-Context-*), a preview (draft) flag, and a cache-bypass for
 * per-visitor responses.
 */
export interface CmsFetchArgs {
  segments?: string[];
  locale?: string;
  preview?: boolean;
  extraHeaders?: Record<string, string>;
  noStore?: boolean;
}

/** Options for fetching article(s). */
export interface CmsArticleArgs {
  preview?: boolean;
  extraHeaders?: Record<string, string>;
}
