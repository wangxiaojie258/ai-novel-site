/**
 * Minimal i18n helper. Loads zh/en message bundles and exposes
 * a `t(locale, key)` function with simple dotted-path lookup.
 *
 * The bundles are imported eagerly to keep SSR cheap. If the bundle
 * grows large, swap to dynamic imports.
 */
import zh from './zh.json';
import en from './en.json';

export type Locale = 'zh' | 'en';
export const DEFAULT_LOCALE: Locale = 'zh';
export const SUPPORTED_LOCALES: Locale[] = ['zh', 'en'];

const bundles: Record<Locale, Record<string, unknown>> = { zh, en };

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'zh' || value === 'en';
}

export function resolveLocale(input: string | undefined | null): Locale {
  if (isLocale(input)) return input;
  if (!input) return DEFAULT_LOCALE;
  const head = input.toLowerCase().split('-')[0];
  return isLocale(head) ? head : DEFAULT_LOCALE;
}

type Primitive = string | number | boolean;

function getByPath(obj: Record<string, unknown>, path: string): Primitive | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean'
    ? (cur as Primitive)
    : undefined;
}

/** Look up a translation; falls back to default locale, then to the key itself. */
export function t(locale: Locale, key: string): string {
  const value =
    getByPath(bundles[locale], key) ??
    getByPath(bundles[DEFAULT_LOCALE], key);
  return value === undefined ? key : String(value);
}

/** Returns the active bundle for a locale (useful for client islands). */
export function getBundle(locale: Locale): Record<string, unknown> {
  return bundles[locale] ?? bundles[DEFAULT_LOCALE];
}
