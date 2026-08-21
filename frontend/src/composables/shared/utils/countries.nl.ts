/**
 * Dutch (nl-NL) country names, keyed by ISO 3166-1 alpha-2 code.
 * Generated from the English `COUNTRIES` list via Intl.DisplayNames('nl')
 * so every entry is an accurate localized name (Nederland, België, …).
 * Passed as the `countries` prop to AddressCard/checkout when the active
 * language is NL, so the country dropdown + display render in Dutch.
 */
import type { Country } from './countries';

export const COUNTRIES_NL: Country[] = [
  { code: 'NL', name: 'Nederland' },
  { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'UK', name: 'Verenigd Koninkrijk' },
  { code: 'US', name: 'Verenigde Staten' },
];
