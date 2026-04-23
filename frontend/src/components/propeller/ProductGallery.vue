<template>
  <div :class="`propeller-product-gallery ${className || ''}`">
    <div class="propeller-product-gallery__stage relative aspect-square bg-card overflow-hidden">
      <template v-if="getImages().length === 0">
        <div class="propeller-product-gallery__empty flex h-full w-full items-center justify-center bg-muted">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="propeller-product-gallery__empty-icon h-24 w-24 text-foreground-subtle"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              :strokeWidth="1"
            ></path>
          </svg>
        </div>
      </template>

      <template v-if="getImages().length > 0">
        <img
          alt="Product image"
          :src="getMainImage()"
          @click="async (event) => openLightbox()"
          :class="`h-full w-full object-contain p-8 transition-transform duration-200 ${
            enableZoom !== false ? 'cursor-zoom-in hover:scale-105' : ''
          }`"
        />
      </template>
    </div>
    <template v-if="showThumbnails !== false && hasThumbnails()">
      <div class="flex gap-3 mt-4 overflow-x-auto pb-2">
        <template :key="index" v-for="(img, index) in getImages()">
          <button
            type="button"
            @click="async (event) => selectImage(index)"
            :class="`propeller-product-gallery__thumbnail relative flex-shrink-0 w-20 h-20 rounded-[var(--radius-container)] border-2 overflow-hidden transition-all bg-card ${
              selectedIndex === index
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-transparent hover:border-border'
            }`"
          >
            <img
              class="w-full h-full object-contain p-1"
              :src="img"
              :alt="`Product image ${index + 1}`"
            />
          </button>
        </template>
      </div>
    </template>

    <template v-if="lightboxOpen">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        @click="async (event) => closeLightbox()"
      >
        <button
          type="button"
          aria-label="Close"
          class="absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
          @click="
            async (e) => {
              e.stopPropagation();
              closeLightbox();
            }
          "
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="h-6 w-6">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
              :strokeWidth="2"
            ></path>
          </svg>
        </button>
        <template v-if="hasThumbnails()">
          <button
            type="button"
            aria-label="Previous image"
            class="absolute left-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
            @click="
              async (e) => {
                e.stopPropagation();
                prevImage();
              }
            "
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="h-6 w-6">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
                :strokeWidth="2"
              ></path>
            </svg>
          </button>
        </template>

        <img
          alt="Product image fullscreen"
          class="max-h-full max-w-full object-contain rounded-[var(--radius-container)]"
          :src="getMainImage()"
          @click="async (e) => e.stopPropagation()"
        />
        <template v-if="hasThumbnails()">
          <button
            type="button"
            aria-label="Next image"
            class="absolute right-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors"
            @click="
              async (e) => {
                e.stopPropagation();
                nextImage();
              }
            "
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="h-6 w-6">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
                :strokeWidth="2"
              ></path>
            </svg>
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

export interface ProductGalleryProps {
  /**
   * Array of image URLs to display.
   * Obtain from: `product.media?.images?.items?.[0]?.imageVariants?.map(v => v.url)`
   * Component is in skeleton/loading state when this is an empty array.
   */
  images: string[];

  /** Show image thumbnails below the main image. Defaults to true. */
  showThumbnails?: boolean;

  /** Enable cursor-zoom-in hint on the main image. Defaults to true. */
  enableZoom?: boolean;

  /** Enable fullscreen lightbox when clicking the main image. Defaults to true. */
  enableLightbox?: boolean;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface ProductGalleryState {
  selectedIndex: number;
  lightboxOpen: boolean;
  getImages: () => string[];
  getMainImage: () => string;
  hasThumbnails: () => boolean;
  selectImage: (index: number) => void;
  openLightbox: () => void;
  closeLightbox: () => void;
  prevImage: () => void;
  nextImage: () => void;
}

const props = withDefaults(defineProps<ProductGalleryProps>(), {
  enableZoom: true,
  showThumbnails: true,
  enableLightbox: true,
});
const selectedIndex = ref<ProductGalleryState['selectedIndex']>(0);
const lightboxOpen = ref<ProductGalleryState['lightboxOpen']>(false);

function getImages(): ReturnType<ProductGalleryState['getImages']> {
  return (props.images as string[]) || [];
}
function getMainImage(): ReturnType<ProductGalleryState['getMainImage']> {
  const images = getImages();
  if (!images || images.length === 0) return '';
  const idx = selectedIndex.value;
  return images[idx] || images[0] || '';
}
function hasThumbnails(): ReturnType<ProductGalleryState['hasThumbnails']> {
  const images = getImages();
  return !!images && images.length > 1;
}
function selectImage(index: number): ReturnType<ProductGalleryState['selectImage']> {
  selectedIndex.value = index;
}
function openLightbox(): ReturnType<ProductGalleryState['openLightbox']> {
  if (props.enableLightbox !== false) {
    lightboxOpen.value = true;
  }
}
function closeLightbox(): ReturnType<ProductGalleryState['closeLightbox']> {
  lightboxOpen.value = false;
}
function prevImage(): ReturnType<ProductGalleryState['prevImage']> {
  const images = getImages();
  const len = images?.length || 0;
  if (len === 0) return;
  selectedIndex.value = (selectedIndex.value - 1 + len) % len;
}
function nextImage(): ReturnType<ProductGalleryState['nextImage']> {
  const images = getImages();
  const len = images?.length || 0;
  if (len === 0) return;
  selectedIndex.value = (selectedIndex.value + 1) % len;
}
</script>
