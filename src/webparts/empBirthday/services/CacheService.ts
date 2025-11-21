export default class CacheService {

  private static CACHE_KEY = "BIRTHDAY_CACHE_v1";
  private static REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  /** Save data to sessionStorage safely */
  public static save(data: any): void {
    try {
      const record = {
        timestamp: Date.now(),
        data
      };

      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn("CacheService.save: Storage exceeded or blocked → clearing cache.", e);
      sessionStorage.removeItem(this.CACHE_KEY);
    }
  }

  /** Load cached data (if exists & valid) */
  public static load(): { timestamp: number; data: any } | null {
    try {
      const raw = sessionStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;

      const record = JSON.parse(raw);

      // Validate structure
      if (
        typeof record !== "object" ||
        typeof record.timestamp !== "number" ||
        record.data === undefined
      ) {
        console.warn("CacheService.load: Invalid cache structure. Clearing...");
        this.clear();
        return null;
      }

      return record;
    } catch (e) {
      console.warn("CacheService.load: Failed to parse cache → clearing.", e);
      this.clear();
      return null;
    }
  }

  /** Check whether cached timestamp is expired */
  public static isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.REFRESH_INTERVAL;
  }

  /** Clear cache safely */
  public static clear(): void {
    try {
      sessionStorage.removeItem(this.CACHE_KEY);
    } catch (e) {
      console.warn("CacheService.clear: Unable to clear cache.", e);
    }
  }
}
