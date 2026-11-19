const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/**
 * `raw` when it is a path on this site ("/account"), else undefined: no scheme,
 * no "//host" or "/\host", no control characters (a browser drops a tab or newline,
 * which turns "/\t/evil.test" into "//evil.test"). For `?redirect=` targets (#14).
 */
export function localPath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.trim()
  if (!value.startsWith('/') || value[1] === '/' || value[1] === '\\' || CONTROL_CHARS.test(value)) return undefined
  return value
}
