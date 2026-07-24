<template>
  <span style="display: none" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * Records a Prepr data-collection event for the current page via the tracking
 * pixel (`window.prepr`, initialised in the app root). Rendering this on a
 * content page is what creates/updates the visitor profile and powers
 * behavioral segments. The visitor id comes from the shared `__prepr_uid`
 * cookie (set by server.js, read by the pixel), so tracking and personalization
 * resolve to the same visitor. No-ops entirely unless Prepr is the CMS.
 */
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { PREPR_ENABLED } from '@/lib/preprEvent'

const props = defineProps<{
  /** Prepr content-item id → fires a `View` event (pages / blog posts). */
  itemId?: string | number
  /** Interest tags → fires a `Tag` event (category pages have no content id). */
  tags?: string[]
}>()

let timer: ReturnType<typeof setInterval> | null = null
let cancelled = false

function fireFor(id: string, tagKey: string): boolean {
  const prepr = (window as unknown as { prepr?: (...a: unknown[]) => void }).prepr
  if (typeof prepr !== 'function') return false
  if (id) prepr('event', 'View', { id })
  else if (tagKey) prepr('event', 'Tag', tagKey.split(','))
  return true
}

function track(): void {
  if (!PREPR_ENABLED || typeof window === 'undefined') return
  const id =
    props.itemId !== undefined && props.itemId !== null && props.itemId !== ''
      ? String(props.itemId)
      : ''
  const tagKey = (props.tags || []).filter(Boolean).join(',')
  if (!id && !tagKey) return

  cleanup()
  cancelled = false
  // The pixel loads async, so `window.prepr` may not exist yet — poll briefly.
  if (fireFor(id, tagKey)) return
  let attempts = 0
  timer = setInterval(() => {
    attempts += 1
    if (cancelled || fireFor(id, tagKey) || attempts > 50) cleanup()
  }, 100)
}

function cleanup(): void {
  cancelled = true
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(track)
watch(() => [props.itemId, (props.tags || []).join(',')], track)
onBeforeUnmount(cleanup)
</script>
