import { createFileProvider } from './providers/file';
import type { TranslationProvider } from '@propeller-commerce/propeller-v2-vue-ui';

let _provider: TranslationProvider | null = null;

export function getTranslationProvider(): TranslationProvider {
  if (_provider) return _provider;
  const which = (import.meta.env.VITE_TRANSLATIONS_PROVIDER as string) ?? 'file';
  switch (which) {
    case 'file':
    default:
      _provider = createFileProvider();
  }
  return _provider;
}
