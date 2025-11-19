export default class CacheService {
  
  private static CACHE_KEY = "BIRTHDAY_CACHE_v1";
  private static REFRESH_INTERVAL = 15 * 60 * 1000; // 15 min

  public static save(data: any) {
    const record = {
      timestamp: new Date().getTime(),
      data
    };
    sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(record));
  }

  public static load() {
    const raw = sessionStorage.getItem(this.CACHE_KEY);
    if (!raw) return null;

    try {
      const record = JSON.parse(raw);
      return record;
    } catch {
      return null;
    }
  }

  public static isExpired(timestamp: number): boolean {
    return (new Date().getTime() - timestamp) > this.REFRESH_INTERVAL;
  }

  public static clear() {
    sessionStorage.removeItem(this.CACHE_KEY);
  }
}
