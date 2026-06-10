import { computed, type ComputedRef } from 'vue';
import { useLanguageStore } from '@/stores/language';
import { getTranslationProvider } from './index';

/**
 * Read a namespace's translated strings, reactive to the current language.
 *
 * Returns a ComputedRef so language switches re-evaluate and rebind the
 * `:labels` prop. The underlying getNamespace() call is sync; the
 * ComputedRef is the Vue-side reactivity wrapper (equivalent to React's
 * Context update path).
 *
 * Works in SSR because useLanguageStore() returns the request-scoped Pinia
 * store entry-server.ts creates; the router beforeEach guard has already
 * set `language` by the time the view renders.
 */
export function useTranslations(
  namespace: string,
): ComputedRef<Record<string, string>> {
  const languageStore = useLanguageStore();
  return computed(() => {
    const locale = languageStore.language.toLowerCase();
    return getTranslationProvider().getNamespace(locale, namespace);
  });
}
