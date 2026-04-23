<template>
  <div :class="`propeller-product-videos ${className || ''}`">
    <template v-if="hasItems()">
      <h3 class="propeller-product-videos__title text-base font-semibold text-foreground mb-3">
        {{ getLabel('title', 'Videos') }}
      </h3>
    </template>

    <template v-if="hasItems()">
      <div class="propeller-product-videos__list space-y-4">
        <template :key="index" v-for="(video, index) in getVideoItems()">
          <div
            class="propeller-product-videos__item rounded-lg overflow-hidden border border-border bg-black"
            :data-embedded="!!getVideoUri(video) && isEmbeddable(getVideoUri(video)) ? 'true' : 'false'"
          >
            <template v-if="!!getVideoUri(video)">
              <template v-if="isEmbeddable(getVideoUri(video))">
                <div
                  class="propeller-product-videos__embed relative w-full"
                  :style="{
                    paddingBottom: '56.25%',
                  }"
                >
                  <iframe
                    loading="lazy"
                    allow="
                      accelerometer;
                      autoplay;
                      clipboard-write;
                      encrypted-media;
                      gyroscope;
                      picture-in-picture;
                    "
                    class="propeller-product-videos__iframe absolute inset-0 w-full h-full"
                    :src="getEmbedUrl(getVideoUri(video))"
                    :title="getVideoTitle(video)"
                    :allowFullScreen="true"
                  ></iframe>
                </div>
              </template>

              <template v-if="!isEmbeddable(getVideoUri(video))">
                <video preload="metadata" class="propeller-product-videos__video w-full" :controls="true">
                  <source :src="getVideoUri(video)" />
                </video>
              </template>
            </template>
          </div>
        </template>
      </div>
    </template>

    <template v-if="!hasItems()">
      <p class="propeller-product-videos__empty text-sm text-muted-foreground">
        {{ getLabel('empty', 'No videos') }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';
import { getLanguageString, getLanguageUri } from '../../composables/shared/utils/languageResolver';
import {
  PaginatedMediaVideoResponse,
  MediaVideo,
  LocalizedVideo,
  LocalizedString,
} from 'propeller-sdk-v2';

export interface ProductVideosProps {
  /**
   * Media videos for the product.
   * Obtain from `product.media.videos`.
   */
  videos: PaginatedMediaVideoResponse;

  /**
   * Language code used to resolve the correct localised video URI.
   */
  language: string;

  /**
   * Override any UI string.
   * Available keys: title, empty
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface ProductVideosState {
  hasItems: () => boolean;
  getVideoItems: () => MediaVideo[];
  getVideoUri: (video: MediaVideo) => string;
  getVideoTitle: (video: MediaVideo) => string;
  isEmbeddable: (uri: string) => boolean;
  getEmbedUrl: (uri: string) => string;
  getLabel: (key: string, fallback: string) => string;
}

const props = defineProps<ProductVideosProps>();

function hasItems(): ReturnType<ProductVideosState['hasItems']> {
  const v = props.videos as PaginatedMediaVideoResponse;
  return !!v?.items && v.items.length > 0;
}
function getVideoItems(): ReturnType<ProductVideosState['getVideoItems']> {
  const v = props.videos as PaginatedMediaVideoResponse;
  return v?.items || [];
}
function getVideoUri(video: MediaVideo): ReturnType<ProductVideosState['getVideoUri']> {
  const lang = (props.language as string) || 'NL';
  const vids = video.videos || [];
  const match = vids.find((v: LocalizedVideo) => v.language === lang);
  return match?.uri || vids?.[0]?.uri || '';
}
function getVideoTitle(video: MediaVideo): ReturnType<ProductVideosState['getVideoTitle']> {
  return getLanguageString(video.alt, props.language || 'NL', 'Video');
}
function isEmbeddable(uri: string): ReturnType<ProductVideosState['isEmbeddable']> {
  return uri.includes('youtube.com') || uri.includes('youtu.be') || uri.includes('vimeo.com');
}
function getEmbedUrl(uri: string): ReturnType<ProductVideosState['getEmbedUrl']> {
  // Already an embed URL — return as-is
  if (uri.includes('youtube.com/embed/') || uri.includes('player.vimeo.com/video/')) {
    return uri;
  }
  // YouTube watch URL → embed URL
  if (uri.includes('youtube.com/watch')) {
    const url = new URL(uri);
    const videoId = url.searchParams.get('v') || '';
    return `https://www.youtube.com/embed/${videoId}`;
  }
  // YouTube short URL
  if (uri.includes('youtu.be/')) {
    const videoId = uri.split('youtu.be/')[1]?.split('?')[0] || '';
    return `https://www.youtube.com/embed/${videoId}`;
  }
  // Vimeo standard URL (https://vimeo.com/ID or https://vimeo.com/ID/HASH)
  if (uri.includes('vimeo.com/')) {
    const parts = uri.split('vimeo.com/')[1]?.split('?')[0]?.split('/') || [];
    const videoId = parts[0] || '';
    const hash = parts[1] || '';
    return hash
      ? `https://player.vimeo.com/video/${videoId}?h=${hash}`
      : `https://player.vimeo.com/video/${videoId}`;
  }
  return uri;
}
function getLabel(key: string, fallback: string): ReturnType<ProductVideosState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
</script>
