import catalog from './catalog.json' with { type: 'json' };
import type { Language } from './locale.ts';

export type TranslationValues = Record<string, string | number>;
type Message = { en: string; 'zh-CN': string };
export const messages: Record<string, Message> = catalog;
const folded = new Map(Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value]));
const templates = Object.entries(messages)
  .filter(([key]) => key.includes('{'))
  .map(([key, value]) => {
    const names: string[] = [];
    const pattern = key
      .split(/(\{\w+\})/)
      .map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          names.push(part.slice(1, -1));
          return '(.+?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return { expression: new RegExp(`^${pattern}$`, 'u'), names, value };
  });

/** Canonical Vietnamese messages stay in game state and saves; localization is display-only. */
export function translate(language: Language, source: string, values?: TranslationValues): string {
  const normalized = source.trim().replace(/\s+/g, ' ');
  const interpolate = (text: string, params: TranslationValues = {}) =>
    text.replace(/\{(\w+)\}/g, (token, key: string) =>
      params[key] === undefined ? token : translate(language, String(params[key])),
    );
  if (language === 'vi') return interpolate(normalized, values);
  const direct = messages[normalized];
  if (direct) return interpolate(direct[language], values);
  const insensitive = folded.get(normalized.toLowerCase());
  if (insensitive) {
    let translated = insensitive[language];
    if (language === 'en') {
      if (normalized === normalized.toUpperCase()) translated = translated.toUpperCase();
      else if (normalized[0] === normalized[0]?.toLowerCase()) {
        translated = translated.charAt(0).toLowerCase() + translated.slice(1);
      }
    }
    return interpolate(translated, values);
  }
  // Worker/renderer messages contain values but never depend on the chosen UI language.
  for (const template of templates) {
    const match = template.expression.exec(normalized);
    if (match)
      return interpolate(
        template.value[language],
        Object.fromEntries(template.names.map((name, i) => [name, match[i + 1]])),
      );
  }
  return interpolate(normalized, values);
}
