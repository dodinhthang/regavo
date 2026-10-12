declare const __RUNTIME_ASSETS__: Record<string, string>;

/** Production uses content-addressed WebP copies; authoring and tests retain source PNGs. */
export function assetUrl(source: string): string {
  return typeof __RUNTIME_ASSETS__ === 'undefined'
    ? source
    : (__RUNTIME_ASSETS__[source] ?? source);
}
