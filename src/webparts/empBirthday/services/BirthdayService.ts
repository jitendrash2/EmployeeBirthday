import { SPFI } from "@pnp/sp";
import { GraphFI } from "@pnp/graph";

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";

import "@pnp/graph/users";
import "@pnp/graph/photos";

import { IBirthday } from "../components/IBirthday";
import placeholderImage from "../assets/user_profile.png";
import CacheService from "./CacheService";

export default class BirthdayService {

  private _sp: SPFI;
  private _graph: GraphFI;

  private defaultListName: string = "EmployeeBirthdays";

  constructor(sp: SPFI, graph: GraphFI) {
    this._sp = sp;
    this._graph = graph;
  }

  // -------------------------
  // MAIN: LOAD EVENTS WITH CACHE
  // -------------------------
  public async getAllEvents(listName: string, daysAhead: number): Promise<IBirthday[]> {

    // 1) Try LOAD FROM CACHE
    const cached = CacheService.load();

    if (cached && !CacheService.isExpired(cached.timestamp)) {
      console.log("Loaded events from CACHE");

      // Start background refresh (non-blocking)
      this.refreshCacheInBackground(listName, daysAhead);

      return cached.data;
    }

    // 2) CACHE EMPTY OR EXPIRED → Load fresh from API
    console.log("Loaded events from API");

    const freshData = await this.loadFreshEvents(listName, daysAhead);

    // Save cache
    CacheService.save(freshData);

    return freshData;
  }

  // -------------------------
  // LOAD LIVE DATA
  // -------------------------
  private async loadFreshEvents(listName: string, daysAhead: number): Promise<IBirthday[]> {
    const birthdays = await this.getBirthdays(listName, daysAhead);
    const anniversaries = await this.getAnniversaries(daysAhead);

    const combined = [...birthdays, ...anniversaries];

    combined.sort((a, b) =>
      (a.NextEventDate?.getTime() ?? 0) -
      (b.NextEventDate?.getTime() ?? 0)
    );

    return combined;
  }

  // -------------------------
  // BACKGROUND REFRESH (15 minutes)
  // -------------------------
  private async refreshCacheInBackground(listName: string, daysAhead: number) {
    setTimeout(async () => {
      console.log("Background refresh started...");

      const data = await this.loadFreshEvents(listName, daysAhead);
      CacheService.save(data);

      console.log("Background refresh complete.");
    }, 200);
  }

  // -------------------------
  // BIRTHDAY LIST (SharePoint)
  // -------------------------
  public async getBirthdays(listName: string, daysAhead: number): Promise<IBirthday[]> {

    const listToUse =
      listName?.trim() !== "" ? listName : this.defaultListName;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysAhead);

    const items = await this._sp.web.lists
      .getByTitle(listToUse)
      .items.select("Title", "Birthday", "Email", "JobTitle")();

    const results: IBirthday[] = [];

    for (const i of items) {
      if (!i.Birthday) continue;

      const birth = new Date(i.Birthday);

      let nextDate = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (nextDate < today) nextDate.setFullYear(nextDate.getFullYear() + 1);

      if (nextDate <= endDate) {
        const photo = await this.getPhoto(i.Email);

        results.push({
          Title: i.Title,
          Email: i.Email,
          JobTitle: i.JobTitle,
          Birthday: i.Birthday,
          PhotoUrl: photo,
          IsAnniversary: false,
          NextEventDate: nextDate,
          IsToday:
            nextDate.getDate() === today.getDate() &&
            nextDate.getMonth() === today.getMonth()
        });
      }
    }

    return results;
  }

  // -------------------------
  // ANNIVERSARIES (Graph Users)
  // -------------------------
  public async getAnniversaries(daysAhead: number): Promise<IBirthday[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await this._graph.users
      .select("displayName", "mail", "jobTitle", "employeeHireDate")
      .top(999)();

    const results: IBirthday[] = [];

    for (const u of users) {
      if (!u.mail) continue;

      let hire = u.employeeHireDate
        ? new Date(u.employeeHireDate)
        : new Date(2017, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

      let nextAnniv = new Date(today.getFullYear(), hire.getMonth(), hire.getDate());
      if (nextAnniv < today) nextAnniv.setFullYear(nextAnniv.getFullYear() + 1);

      const yearsCompleted = nextAnniv.getFullYear() - hire.getFullYear();
      const photo = await this.getPhoto(u.mail);

      results.push({
        Title: u.displayName ?? "Unknown User",
        Email: u.mail ?? "",
        JobTitle: u.jobTitle ?? "",
        HireDate: hire.toISOString(),
        YearsCompleted: yearsCompleted,
        PhotoUrl: photo,
        IsAnniversary: true,
        NextEventDate: nextAnniv,
        IsToday:
          nextAnniv.getDate() === today.getDate() &&
          nextAnniv.getMonth() === today.getMonth()
      });
    }

    return results;
  }

  // -------------------------
  // GET PHOTO
  // -------------------------
  private async getPhoto(email: string): Promise<string> {
  try {
    const blob = await this._graph.users.getById(email).photo.getBlob();

    return await this.blobToBase64(blob); // convert to base64
  } catch {
    return placeholderImage; // always fallback
  }
}

private blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

}
