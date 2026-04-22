export function getLabel(
  labels: Record<string, string> | undefined,
  key: string,
  fallback: string
): string {
  return labels?.[key] || fallback;
}
