interface ICacheRecord<T> {
  timestamp: number;
  data: T;
}

export default class CacheService {

  private static readonly CACHE_PREFIX = "BIRTHDAY_CACHE_v4";
  private static readonly REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  private static getStorage(): Storage | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }

    try {
      return window.localStorage;
    } catch (localStorageError) {
      console.warn("CacheService: localStorage unavailable, trying sessionStorage.", localStorageError);
    }

    try {
      return window.sessionStorage;
    } catch (sessionStorageError) {
      console.warn("CacheService: sessionStorage unavailable.", sessionStorageError);
      return undefined;
    }
  }

  private static getCacheKey(scope: string): string {
    return `${this.CACHE_PREFIX}:${scope}`;
  }

  /** Save data to browser storage safely */
  public static save<T>(scope: string, data: T): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      const record = {
        timestamp: Date.now(),
        data
      };

      storage.setItem(this.getCacheKey(scope), JSON.stringify(record));
    } catch (e) {
      console.warn("CacheService.save: Storage exceeded or blocked → clearing cache.", e);
      this.clear(scope);
    }
  }

  /** Load cached data (if exists & valid) */
  public static load<T>(scope: string): ICacheRecord<T> | undefined {
    const storage = this.getStorage();

    if (!storage) {
      return undefined;
    }

    try {
      const raw = storage.getItem(this.getCacheKey(scope));
      if (!raw) return undefined;

      const record = JSON.parse(raw);

      // Validate structure
      if (
        typeof record !== "object" ||
        typeof record.timestamp !== "number" ||
        record.data === undefined
      ) {
        console.warn("CacheService.load: Invalid cache structure. Clearing...");
        this.clear(scope);
        return undefined;
      }

      return record as ICacheRecord<T>;
    } catch (e) {
      console.warn("CacheService.load: Failed to parse cache → clearing.", e);
      this.clear(scope);
      return undefined;
    }
  }

  /** Check whether cached timestamp is expired */
  public static isExpired(timestamp: number): boolean {
    return Date.now() - timestamp >= this.REFRESH_INTERVAL;
  }

  public static getRefreshInterval(): number {
    return this.REFRESH_INTERVAL;
  }

  /** Clear cache safely */
  public static clear(scope: string): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(this.getCacheKey(scope));
    } catch (e) {
      console.warn("CacheService.clear: Unable to clear cache.", e);
    }
  }
}
