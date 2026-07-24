<template>
  <span style="display: none" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * Enables Prepr's in-preview segment & A/B-test switcher (and visual-editing
 * scroll-sync) without pulling in @preprio/prepr-nextjs. When our site runs
 * inside Prepr's preview iframe we post the `prepr_preview_bar` `loaded` event
 * to the parent — that reveals the switches in Prepr's preview bar. Changing a
 * switch reloads the iframe with `?prepr_preview_segment` / `?prepr_preview_ab`,
 * which server.js turns into Prepr-Segments / Prepr-ABTesting headers. Outside
 * an iframe this is a no-op, so the live site is unaffected. No-ops unless Prepr
 * is the CMS.
 */
import { onMounted, onBeforeUnmount } from 'vue'
import { PREPR_ENABLED } from '@/lib/preprEvent'

type PreprMessage = { name: 'prepr_preview_bar'; event: string } & Record<string, unknown>

function sendPreprEvent(event: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const message: PreprMessage = { name: 'prepr_preview_bar', event, ...(data || {}) }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*')
  }
}

let parentOrigin: string | null = null

function handleMessage(evt: MessageEvent): void {
  const data = evt.data as { event?: string; scrollPosition?: number } | null

  if (data?.event === 'prepr:initVE' && !parentOrigin) {
    parentOrigin = evt.origin
    if (data.scrollPosition) {
      const top = data.scrollPosition
      setTimeout(() => window.scrollTo(0, top), 1)
    }
  }
  if (evt.origin !== parentOrigin) return
  if (data?.event === 'prepr:getScrollPosition') {
    const y = window.scrollY || document.documentElement.scrollTop
    sendPreprEvent('getScrollPosition', { value: y })
  }
}

onMounted(() => {
  // Only relevant inside Prepr's preview iframe; live site is a no-op.
  if (!PREPR_ENABLED || typeof window === 'undefined' || window.parent === window) return
  sendPreprEvent('getScrollPosition', { value: 0 })
  sendPreprEvent('loaded') // handshake — enables the segment / A-B switches
  window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('message', handleMessage)
})
</script>
