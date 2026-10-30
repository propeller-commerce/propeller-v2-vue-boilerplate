// reCAPTCHA v3 loader; a no-op unless VITE_RECAPTCHA_SITE_KEY is set.

interface Grecaptcha {
  ready(cb: () => void): void
  execute(siteKey: string, opts: { action: string }): Promise<string>
}

// Read the one variable by name so Vite inlines nothing else.
const SITE_KEY: string = (() => {
  try {
    return import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''
  } catch {
    return ''
  }
})()

let loading: Promise<Grecaptcha | undefined> | undefined

export function isRecaptchaEnabled(): boolean {
  return !!SITE_KEY && typeof window !== 'undefined'
}

export function loadRecaptcha(): Promise<Grecaptcha | undefined> {
  if (!isRecaptchaEnabled()) return Promise.resolve(undefined)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`
    script.async = true
    script.onload = () => resolve((window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha)
    script.onerror = () => {
      loading = undefined
      resolve(undefined)
    }
    document.head.appendChild(script)
  })
  return loading
}

export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  const g = await loadRecaptcha()
  if (!g) return undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      g.ready(() => {
        g.execute(SITE_KEY, { action }).then(resolve, reject)
      })
    })
  } catch {
    return undefined
  }
}
