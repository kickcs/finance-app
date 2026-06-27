import { createI18n } from 'vue-i18n';
import { initialLocale } from './detectLocale';

export type AppLocale = 'ru' | 'en';

type MessageValue = string | MessageTree | MessageValue[];
interface MessageTree {
  [key: string]: MessageValue;
}
type LocaleJson = MessageTree;

// Files live at @/<layer>/<slice>/locales/{ru,en}.json (+ shared namespace).
// Namespace is derived from the path: features/add-transaction/locales/ru.json
// → messages.ru.features.addTransaction.*
function buildMessages(): Record<AppLocale, LocaleJson> {
  const modules = import.meta.glob<{ default: LocaleJson }>('@/**/locales/*.json', {
    eager: true,
  });
  const messages: Record<AppLocale, LocaleJson> = { ru: {}, en: {} };

  for (const [path, mod] of Object.entries(modules)) {
    const match = path.match(/\/src\/(.+)\/locales\/(ru|en)\.json$/);
    if (!match) continue;
    const [, slicePath, locale] = match;
    const data = (mod as { default: LocaleJson }).default;

    // FSD path → camelCase segments → nested namespace.
    // e.g. features/add-transaction → features.addTransaction; the shared dict
    // at shared/locales → shared.* (no special-casing needed).
    const segments = slicePath.split('/').map(toCamel);
    assignDeep(messages[locale as AppLocale], segments, data);
  }
  return messages;
}

function toCamel(seg: string): string {
  return seg.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function assignDeep(target: LocaleJson, segments: string[], value: LocaleJson): void {
  let node = target;
  for (let i = 0; i < segments.length - 1; i++) {
    node[segments[i]] ??= {};
    node = node[segments[i]] as LocaleJson;
  }
  node[segments[segments.length - 1]] = value;
}

// messages are assembled dynamically from FSD slices; vue-i18n's strict schema
// inference can't model that shape, so we pass the plain message tree. With
// `legacy: false` the runtime exposes a Composer on `i18n.global`, whose
// `locale` is a writable ref — typed locally since the dynamic schema defeats
// vue-i18n's own inference here.
export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'ru',
  messages: buildMessages(),
});

export function setI18nLocale(locale: AppLocale): void {
  (i18n.global.locale as unknown as { value: AppLocale }).value = locale;
}
