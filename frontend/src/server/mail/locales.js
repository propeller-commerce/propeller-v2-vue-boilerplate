import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Read a locale namespace from disk.
 *
 * `src/lib/i18n` cannot be reused here: its provider reads `import.meta.env`,
 * which only exists under Vite, and this tree is loaded by plain Node. The JSON
 * files are the same source of truth either way.
 */

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../locales'
);

const cache = new Map();

/**
 * @param {string} locale     e.g. 'nl' or 'NL'
 * @param {string} namespace  e.g. 'PriceRequest'
 * @returns {Record<string, string>} empty when unknown — callers fall back.
 */
export function getTranslations(locale, namespace) {
  const lang = String(locale || '').toLowerCase();
  const key = `${lang}/${namespace}`;
  if (cache.has(key)) return cache.get(key);
  let dict = {};
  try {
    dict = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, lang, `${namespace}.json`), 'utf8')
    );
  } catch {
    dict = {};
  }
  cache.set(key, dict);
  return dict;
}

/** Namespace lookup with a fallback, as getLabel does client-side. */
export function labeller(dict) {
  return (key, fallback) => dict[key] || fallback;
}
