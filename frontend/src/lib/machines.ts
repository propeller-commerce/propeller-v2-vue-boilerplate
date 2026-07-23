/**
 * Machine (spare-parts) route helpers for the Vue app — mirrors
 * propeller-next/lib/machines.ts.
 *
 * Runtime-agnostic (no browser globals): the machines view reads sort defaults,
 * the depth cap and the installation-id resolution from here so the URL shape
 * and behaviour match the React boilerplate exactly.
 */

import { ProductSortField, SortOrder } from '@propeller-commerce/propeller-sdk-v2'
import type { SparePartsMachine, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2'
import { configuration } from '@/lib/config'

/** Company track attribute holding the contact's installation ids. */
const MY_INSTALLATIONS = 'MY_INSTALLATIONS'

/**
 * Read the contact's installation ids off the company `MY_INSTALLATIONS` track
 * attribute, resolving which company applies the same way the company store does
 * (`syncFromUser`): the switched company (matched by id in the user's
 * companies), else the default. The company must carry hydrated `.attributes`
 * (login / `refreshUser` fetch them with `companyAttributesInput`).
 *
 * Returns `[]` for anonymous visitors and customers (no company).
 */
export function resolveInstallationIds(
  user: Contact | Customer | null | undefined,
  selectedCompanyId: number | undefined,
): string[] {
  const contact = user && 'contactId' in user ? (user as Contact) : null
  if (!contact) return []
  const company =
    (selectedCompanyId != null &&
      contact.companies?.items?.find((c) => c?.companyId === selectedCompanyId)) ||
    contact.company ||
    null
  const items = company?.attributes?.items ?? []
  const match = items.find((i) => i.attributeDescription?.name === MY_INSTALLATIONS)
  return readAttributeStringValues(match?.value)
}

/**
 * Pull a string list off an SDK `AttributeValue`. A TEXT attribute carries
 * `textValues[].values` (per language), an ENUM carries `enumValues`. Falls back
 * to a comma-split scalar `.value`. Cross-language repeats are deduped, order
 * preserved.
 */
export function readAttributeStringValues(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const v = value as {
    textValues?: { values?: unknown[] }[]
    enumValues?: unknown[]
    value?: unknown
  }
  const out: string[] = []
  if (Array.isArray(v.textValues)) {
    for (const tv of v.textValues) for (const s of tv?.values ?? []) out.push(String(s))
  }
  if (Array.isArray(v.enumValues)) {
    for (const s of v.enumValues) out.push(String(s))
  }
  if (out.length === 0 && v.value != null) {
    return String(v.value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))]
}

/**
 * The language the machine TREE is authored in — not the storefront language.
 * `machine(slug:, language:)` is language-scoped and hard-errors when the
 * machine has no name/slug in that language. Names/slugs are typically English
 * only, while the spare parts are localized.
 */
export const MACHINE_LANGUAGE: string = configuration.machines?.language || 'EN'

/** Storefront browse depth for the machine tree (the WP reference caps at 5). */
export const MACHINE_MAX_DEPTH = 5

/** Default sort for a machine's spare-parts list — alphabetical by name. */
export const MACHINE_SORT_FIELD_DEFAULT = ProductSortField.NAME
export const MACHINE_SORT_ORDER_DEFAULT = SortOrder.ASC

/** Resolve a machine's slug for a language, falling back to its first. */
export function getMachineSlug(machine: SparePartsMachine, language: string): string {
  return (
    machine.slug?.find((s) => s.language === language)?.value ??
    machine.slug?.[0]?.value ??
    ''
  )
}

/** Resolve a machine's display name for a language, falling back to its first. */
export function getMachineName(
  machine: SparePartsMachine,
  language: string,
  fallback = 'Machine',
): string {
  return (
    machine.name?.find((n) => n.language === language)?.value ??
    machine.name?.[0]?.value ??
    fallback
  )
}

/**
 * Turn a URL slug into a human-ish label for a breadcrumb. Ancestor segments in
 * `/machines/a/b/c` are display-only — the backend is only ever asked about the
 * LAST one — so title-casing the slug avoids N extra round-trips to label them.
 */
export function machineSlugToLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
