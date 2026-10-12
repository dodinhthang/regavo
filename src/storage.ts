export const STORAGE_KEYS = {
  save: 'regavo-save-v1',
  language: 'regavo-language',
  audio: 'regavo-audio',
} as const;

type ProjectStorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
type ReadableStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>>;

// Keep existing saves and preferences available after the project rename.
const LEGACY_KEYS: Record<ProjectStorageKey, string> = {
  [STORAGE_KEYS.save]: 'imperia-save-v1',
  [STORAGE_KEYS.language]: 'imperia-language',
  [STORAGE_KEYS.audio]: 'imperia-audio',
};

export function readProjectStorage(
  storage: ReadableStorage | undefined,
  key: ProjectStorageKey,
): string | null {
  try {
    const current = storage?.getItem(key);
    if (current != null) return current;
    const legacy = storage?.getItem(LEGACY_KEYS[key]) ?? null;
    if (legacy != null) {
      try {
        storage?.setItem?.(key, legacy);
      } catch {
        // A full or read-only store still permits reading the existing value.
      }
    }
    return legacy;
  } catch {
    return null;
  }
}
