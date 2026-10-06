/** Replace through this contract with a Redis adapter for multi-instance deployment. */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
export class LocalCache implements CacheProvider {
  private entries = new Map<string, { value: unknown; expires: number }>();
  async get<T>(key: string): Promise<T | null> {
    const e = this.entries.get(key);
    if (!e || e.expires < Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return e.value as T;
  }
  async set<T>(key: string, value: T, ttlSeconds: number) {
    if (this.entries.size >= 1000)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
  async delete(key: string) {
    this.entries.delete(key);
  }
}
export interface GenerationQueue {
  enqueue(jobId: string): Promise<void>;
}
/** Current MVP processes database-backed jobs synchronously; an external queue must preserve review states. */
export interface AgeVerificationProvider {
  begin(userId: string): Promise<{ reference: string; redirectUrl: string }>;
  verifyCallback(
    payload: string,
    signature: string,
  ): Promise<{ reference: string; status: "VERIFIED" | "REJECTED" }>;
}
