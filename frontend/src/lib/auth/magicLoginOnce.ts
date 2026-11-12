/**
 * One sign-in per magic token. A company change remounts the router view, so
 * MagicLoginView mounts again mid-login; the one-time token must not be spent twice.
 */
const pending = new Map<string, Promise<string | null>>()

/** Runs `signIn` once per token; later calls get the same result (the page to go to, or null). */
export function onceForToken(token: string, signIn: () => Promise<string | null>): Promise<string | null> {
  let result = pending.get(token)
  if (!result) {
    result = signIn()
    pending.set(token, result)
  }
  return result
}
