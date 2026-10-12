import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGE_NAMES,
  ANIMAL_NAMES,
  BUILDINGS,
  CIVS,
  UNITS,
  RESOURCE_NAMES,
  unitDefinition,
} from '../src/game/data.ts';
import { MATERIALS } from '../src/ui/theme.ts';
import {
  LANGUAGES,
  LANGUAGE_KEY,
  initialLanguage,
  rememberLanguage,
  resolveLanguage,
  countryLanguage,
} from '../src/i18n/locale.ts';
import { messages, translate } from '../src/i18n/translate.ts';

test('browser language detection respects preference order and regional variants', () => {
  assert.equal(resolveLanguage(null, ['vi-VN', 'en-US']), 'vi');
  assert.equal(resolveLanguage(null, ['fr-FR', 'zh-Hans-CN', 'en']), 'zh-CN');
  assert.equal(resolveLanguage(null, ['en-GB', 'vi']), 'en');
  assert.equal(resolveLanguage(null, ['zh-TW']), 'zh-CN');
  assert.equal(resolveLanguage(null, ['de-DE']), 'en');
  assert.equal(resolveLanguage(null, []), 'en');
});

test('Cloudflare country takes priority over browser languages unless a choice is saved', () => {
  assert.equal(resolveLanguage(null, ['en-US', 'vi-VN'], 'VN'), 'vi');
  assert.equal(resolveLanguage(null, ['vi-VN'], 'CN'), 'zh-CN');
  assert.equal(resolveLanguage(null, ['vi-VN'], 'US'), 'en');
  assert.equal(resolveLanguage('en', ['vi-VN'], 'VN'), 'en');
  assert.equal(resolveLanguage('vi', ['en-US'], 'CN'), 'vi');
  assert.equal(resolveLanguage('unsupported', ['en-US'], 'VN'), 'vi');
  assert.equal(resolveLanguage(null, [], 'VN'), 'vi');
  assert.equal(countryLanguage('vn'), 'vi');
  for (const country of [undefined, null, '', 'XX', 'T1', 'FR', {}, 'constructor']) {
    assert.equal(countryLanguage(country), undefined);
    assert.equal(resolveLanguage(null, ['vi-VN'], country), 'vi');
    assert.equal(resolveLanguage(null, ['de-DE'], country), 'en');
  }
});

test('initial language uses country metadata without saving the automatic selection', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  assert.equal(initialLanguage(storage, ['en-US'], 'VN'), 'vi');
  assert.equal(values.size, 0);
  rememberLanguage(storage, 'en');
  assert.equal(initialLanguage(storage, ['vi-VN'], 'VN'), 'en');
  assert.equal(initialLanguage(undefined, ['en-US'], 'VN'), 'vi');
});

test('explicit preferences survive reload and invalid values fall back to the browser', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  rememberLanguage(storage, 'zh-CN');
  assert.equal(values.get(LANGUAGE_KEY), 'zh-CN');
  assert.equal(initialLanguage(storage, ['vi-VN']), 'zh-CN');
  values.set(LANGUAGE_KEY, 'unsupported');
  assert.equal(initialLanguage(storage, ['vi-VN']), 'vi');
});

test('blocked storage still permits browser detection and language switching', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(initialLanguage(blocked, ['en-US']), 'en');
  assert.equal(initialLanguage(blocked, ['en-US'], 'VN'), 'vi');
  assert.doesNotThrow(() => rememberLanguage(blocked, 'vi'));
});

test('all civilization, roster, architecture, animal and resource labels have both translations', () => {
  const texts = [
    ...AGE_NAMES,
    ...Object.values(ANIMAL_NAMES),
    ...Object.values(RESOURCE_NAMES),
    ...Object.values(MATERIALS).flat(),
    ...Object.values(CIVS).flatMap((civ) => [
      civ.name,
      civ.subtitle,
      civ.description,
      ...civ.signature,
    ]),
    ...Object.values(BUILDINGS).flatMap((building) => [building.name, building.description]),
    ...Object.keys(CIVS).flatMap((civ) =>
      Object.keys(UNITS).flatMap((type) => {
        const unit = unitDefinition(type, civ as keyof typeof CIVS);
        return [unit.name, unit.description];
      }),
    ),
  ];
  for (const text of texts)
    for (const language of ['en', 'zh-CN'] as const) {
      assert.ok(messages[text]?.[language], `${language}: ${text}`);
      assert.equal(translate(language, text), messages[text][language], `${language}: ${text}`);
    }
});

test('each translated template retains all placeholders', () => {
  const placeholders = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [source, variants] of Object.entries(messages)) {
    for (const language of ['en', 'zh-CN'] as const) {
      assert.ok(variants[language].trim(), `${language}: ${source}`);
      assert.deepEqual(
        placeholders(variants[language]),
        placeholders(source),
        `${language}: ${source}`,
      );
    }
  }
});

test('templates localize nested names and runtime messages without changing canonical state', () => {
  const message = 'Đã tới đời 3: Đế quốc.';
  assert.equal(translate('en', message), 'Reached Age 3: Empire.');
  assert.equal(translate('zh-CN', message), '已进入时代 3：帝国。');
  assert.equal(message, 'Đã tới đời 3: Đế quốc.');
  assert.equal(translate('en', 'Nhà ở đã hoàn thành.'), 'House completed.');
  assert.equal(
    translate('zh-CN', 'Mang {amount} {resource}', { amount: 10, resource: 'Gỗ' }),
    '携带 10 木材',
  );
  assert.equal(translate('vi', 'Lên đời {age}', { age: 2 }), 'Lên đời 2');
  for (const language of LANGUAGES)
    assert.equal(translate(language, 'Unknown WebGL error'), 'Unknown WebGL error');
});

test('case variants and whitespace keep HUD labels localized', () => {
  assert.equal(translate('en', 'ĐỒNG BẰNG'), 'PLAINS');
  assert.equal(translate('en', 'thịt'), 'meat');
  assert.equal(translate('zh-CN', '  LƯƠNG THỰC  '), '食物');
});
