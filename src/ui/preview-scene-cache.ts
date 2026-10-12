/** Completed scenes survive sprite atlas eviction; queued work is cancelled on selection changes. */
export class PreviewSceneCache<T> {
  private entries = new Map<string, { scene: T; bytes: number }>();
  private bytes = 0;
  private queue: Promise<void> = Promise.resolve();
  private readonly byteLimit: number;

  constructor(byteLimit: number) {
    this.byteLimit = byteLimit;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.scene;
  }

  load(key: string, bytes: number, signal: AbortSignal, create: () => Promise<T>): Promise<T> {
    if (signal.aborted) return Promise.reject(signal.reason);
    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    // Rendering uses shared sprite atlases, so scene preparations must not evict each other.
    const task = this.queue.then(async () => {
      signal.throwIfAborted();
      const existing = this.get(key);
      if (existing !== undefined) return existing;
      const scene = await create();
      signal.throwIfAborted();
      if (bytes <= this.byteLimit) {
        while (this.bytes + bytes > this.byteLimit && this.entries.size) {
          const oldest = this.entries.keys().next().value!;
          this.bytes -= this.entries.get(oldest)!.bytes;
          this.entries.delete(oldest);
        }
        this.entries.set(key, { scene, bytes });
        this.bytes += bytes;
      }
      return scene;
    });
    this.queue = task.then(
      () => {},
      () => {},
    );
    return task;
  }
}
