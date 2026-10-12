import assert from 'node:assert/strict';
import test from 'node:test';
import { readProjectStorage, STORAGE_KEYS } from '../src/storage.ts';
import { initialLanguage } from '../src/i18n/locale.ts';

function memoryStorage(entries: [string, string][] = []) {
  const values = new Map(entries);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test('existing saves, audio settings and language choices survive the rename and reload', () => {
  const entries: [string, (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS], string][] = [
    ['imperia-save-v1', STORAGE_KEYS.save, '{"version":1,"tick":1200}'],
    ['imperia-audio', STORAGE_KEYS.audio, '{"muted":true,"volume":0.2}'],
    ['imperia-language', STORAGE_KEYS.language, 'zh-CN'],
  ];
  const storage = memoryStorage(entries.map(([legacy, , value]) => [legacy, value]));
  for (const [, key, value] of entries) {
    assert.equal(readProjectStorage(storage, key), value);
    assert.equal(storage.values.get(key), value);
  }
  assert.equal(initialLanguage(storage, ['vi-VN']), 'zh-CN');
  const reloaded = memoryStorage([...storage.values].filter(([key]) => key.startsWith('regavo-')));
  assert.equal(readProjectStorage(reloaded, STORAGE_KEYS.save), entries[0][2]);
  assert.equal(readProjectStorage(reloaded, STORAGE_KEYS.audio), entries[1][2]);
  assert.equal(initialLanguage(reloaded, ['vi-VN']), 'zh-CN');
});

test('new preferences and saves take precedence over older values', () => {
  const storage = memoryStorage([
    ['imperia-language', 'zh-CN'],
    [STORAGE_KEYS.language, 'en'],
    ['imperia-save-v1', 'old save'],
    [STORAGE_KEYS.save, 'new save'],
  ]);
  assert.equal(initialLanguage(storage, ['vi-VN']), 'en');
  assert.equal(readProjectStorage(storage, STORAGE_KEYS.save), 'new save');
  assert.equal(storage.values.get(STORAGE_KEYS.language), 'en');
  assert.equal(storage.values.get(STORAGE_KEYS.save), 'new save');
});

test('existing values remain readable when migration writes are blocked', () => {
  const storage = memoryStorage([['imperia-language', 'vi']]);
  storage.setItem = () => {
    throw new Error('quota exceeded');
  };
  assert.equal(initialLanguage(storage, ['en-US']), 'vi');
  assert.equal(storage.values.get('imperia-language'), 'vi');
  assert.equal(storage.values.has(STORAGE_KEYS.language), false);
});

test('missing or inaccessible storage returns no saved value', () => {
  assert.equal(readProjectStorage(undefined, STORAGE_KEYS.save), null);
  assert.equal(readProjectStorage(memoryStorage(), STORAGE_KEYS.save), null);
  assert.equal(
    readProjectStorage(
      {
        getItem: () => {
          throw new Error('blocked');
        },
      },
      STORAGE_KEYS.save,
    ),
    null,
  );
});
