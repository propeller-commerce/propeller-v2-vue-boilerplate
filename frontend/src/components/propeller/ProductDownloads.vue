<template>
  <div :class="`propeller-product-downloads ${className || ''}`">
    <template v-if="hasItems()">
      <h3
        class="propeller-product-downloads__title text-base font-semibold text-foreground mb-3"
      >
        {{ getLabel("title", "Downloads") }}
      </h3>
    </template>

    <template v-if="hasItems()">
      <ul class="propeller-product-downloads__list space-y-2">
        <template :key="index" v-for="(doc, index) in getDownloadItems()">
          <li class="propeller-product-downloads__item">
            <template v-if="!!getDocumentUrl(doc)">
              <a
                target="_blank"
                class="propeller-product-downloads__link flex items-center gap-3 rounded-[var(--radius-container)] border border-border bg-card px-4 py-3 text-sm text-foreground hover:bg-surface-hover/30 hover:border-primary/40 transition-colors group"
                :href="getDocumentUrl(doc)"
                :download="true"
                ><svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  class="h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    :strokeWidth="1.5"
                  ></path></svg
                ><span class="flex-1 min-w-0 truncate">{{
                  getDocumentName(doc)
                }}</span
                ><svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  class="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    :strokeWidth="2"
                  ></path></svg
              ></a>
            </template>
          </li>
        </template>
      </ul>
    </template>

    <template v-if="!hasItems()">
      <p
        class="propeller-product-downloads__empty text-sm text-muted-foreground"
      >
        {{ getLabel("empty", "No downloads") }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import {
  getLanguageString,
  getLanguageUri,
} from "../../composables/shared/utils/languageResolver";
import {
  PaginatedMediaDocumentResponse,
  MediaDocument,
  LocalizedDocument,
  LocalizedString,
} from "propeller-sdk-v2";

export interface ProductDownloadsProps {
  /**
   * Media documents for the product.
   * Obtain from `product.media.documents`.
   */
  downloads: PaginatedMediaDocumentResponse;

  /**
   * Language code used to resolve the correct localised document URL and label.
   */
  language: string;

  /**
   * Override any UI string.
   * Available keys: title, download, empty
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface ProductDownloadsState {
  hasItems: () => boolean;
  getDownloadItems: () => MediaDocument[];
  getDocumentUrl: (doc: MediaDocument) => string;
  getDocumentName: (doc: MediaDocument) => string;
  getDocumentMime: (doc: MediaDocument) => string;
  getLabel: (key: string, fallback: string) => string;
}

const props = defineProps<ProductDownloadsProps>();

function hasItems(): ReturnType<ProductDownloadsState["hasItems"]> {
  const d = props.downloads as PaginatedMediaDocumentResponse;
  return !!d?.items && d.items.length > 0;
}
function getDownloadItems(): ReturnType<
  ProductDownloadsState["getDownloadItems"]
> {
  const d = props.downloads as PaginatedMediaDocumentResponse;
  return d?.items || [];
}
function getDocumentUrl(
  doc: MediaDocument,
): ReturnType<ProductDownloadsState["getDocumentUrl"]> {
  const lang = (props.language as string) || "NL";
  const docs = doc.documents || [];
  const match = docs.find((d: LocalizedDocument) => d.language === lang);
  return match?.originalUrl || docs?.[0]?.originalUrl || "";
}
function getDocumentName(
  doc: MediaDocument,
): ReturnType<ProductDownloadsState["getDocumentName"]> {
  return getLanguageString(doc.alt, props.language || "NL", "Download");
}
function getDocumentMime(
  doc: MediaDocument,
): ReturnType<ProductDownloadsState["getDocumentMime"]> {
  const lang = (props.language as string) || "NL";
  const docs = doc.documents || [];
  const match = docs.find((d: LocalizedDocument) => d.language === lang);
  return match?.mimeType || docs?.[0]?.mimeType || "";
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<ProductDownloadsState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
</script>
