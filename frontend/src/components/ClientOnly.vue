<script setup lang="ts">
/**
 * `<ClientOnly>` — renders its slot only in the browser, after mount.
 *
 * Vue's own `<ClientOnly>` ships with Nuxt, not with a bare Vite SSR setup, so
 * the storefront provides its own. Wrap interactive sub-trees that fetch on
 * mount or touch browser APIs (the product grid, configurators, cart widgets)
 * so they:
 *   - are skipped during `renderToString` (no server-side fetch, no
 *     `window`-not-defined),
 *   - and mount fresh on the client without a hydration-mismatch warning.
 *
 * The SEO-critical shell (title, breadcrumbs, description, <head> meta) is
 * rendered *outside* this boundary so it is in the server HTML; only the
 * interactive island waits for the client.
 *
 * The optional `#fallback` slot renders on the server and until mount — use it
 * for a skeleton so there is no layout shift when the real content appears.
 */
import { ref, onMounted } from 'vue'

const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <slot v-if="mounted" />
  <slot v-else name="fallback" />
</template>
