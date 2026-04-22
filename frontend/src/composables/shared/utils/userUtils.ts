/**
 * Recursively removes leading underscores from object keys.
 * The propeller-sdk-v2 serializes class instances with private fields as _fieldName.
 * This normalizes them to fieldName so localStorage round-trips and type guards work.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripLeadingUnderscores(obj: unknown): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripLeadingUnderscores);
  if (typeof obj === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = key.startsWith('_') ? key.slice(1) : key;
      result[newKey] = stripLeadingUnderscores(value);
    }
    return result;
  }
  return obj;
}
