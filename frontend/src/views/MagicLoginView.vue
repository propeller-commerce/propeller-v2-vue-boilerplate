<template>
  <div class="min-h-[70vh] flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
    <div
      v-if="!failed"
      class="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"
    />
    <p class="text-muted-foreground">
      {{ failed ? 'This login link is no longer valid. Redirecting…' : 'Signing you in…' }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Magic-token login entry — `/magic-login?mtoken=<token>` (optional `?redirect=`).
 *
 * Exchanges a backend/ERP-issued token for a session via the package
 * `useAuth().magicLogin`, then runs the shared post-login sequence
 * (`useAfterLogin`) — identical to password login — and redirects. A dead token
 * bounces to `/login?magic_expired=1`.
 */
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@propeller-commerce/propeller-v2-vue-ui'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'
import { useAfterLogin } from '@/composables/useAfterLogin'
import { track } from '@/lib/tracking/bus'
import { onceForToken } from '@/lib/auth/magicLoginOnce'

const router = useRouter()
const route = useRoute()
const languageStore = useLanguageStore()
const runAfterLogin = useAfterLogin()
const { magicLogin } = useAuth({ graphqlClient, configuration })
const failed = ref(false)

onMounted(async () => {
  const token = (route.query.mtoken as string) || ''
  const redirect = (route.query.redirect as string) || ''

  const target = token ? await onceForToken(token, () => signIn(token, redirect)) : null
  if (!target) {
    failed.value = true
    router.replace(`${localizeHref('/login', languageStore.language)}?magic_expired=1`)
    return
  }
  router.replace(target)
})

/** Exchanges the token and runs the post-login steps; returns the page to go to, or null. */
async function signIn(token: string, redirect: string): Promise<string | null> {
  // Clear any stale token so the exchange is anonymous (matches the WP flow) and
  // a magic link can hand off to a DIFFERENT contact than the one signed in.
  graphqlClient.clearAccessToken()

  const res = await magicLogin(token)
  if (!res.ok || !res.data.user) return null

  // A magic token is how a punchout buyer arrives from their procurement
  // system, so the session start is worth its own event — `login` alone cannot
  // distinguish it from someone typing a password.
  track(
    'propeller.punchout_session_started',
    { method: 'magic_token', redirect: redirect || '/' },
    `punchout_session_started:${token.slice(0, 12)}`,
  )

  const { effectiveLanguage } = await runAfterLogin(
    res.data.user,
    res.data.accessToken,
    res.data.refreshToken,
    res.data.expiresAt,
    null,
    'magic_token',
  )
  return redirect || localizeHref('/', effectiveLanguage)
}
</script>
