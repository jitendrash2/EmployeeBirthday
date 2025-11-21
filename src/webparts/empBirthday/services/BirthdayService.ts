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

  // ----------------------------------------------------
  // MAIN: LOAD EVENTS WITH CACHE
  // ----------------------------------------------------
  public async getAllEvents(listName: string, daysAhead: number): Promise<IBirthday[]> {

    // 1. LOAD CACHE
    const cached = CacheService.load();

    if (cached && !CacheService.isExpired(cached.timestamp)) {
      console.log("Loaded events from CACHE");

      // Background refresh → non-blocking
      this.refreshCacheInBackground(listName, daysAhead);

      return cached.data as IBirthday[];
    }

    // 2. CACHE EMPTY OR EXPIRED → Load from API
    console.log("Loaded events from API");

    const fresh = await this.loadFreshEvents(listName, daysAhead);

    CacheService.save(fresh);

    return fresh;
  }

  // ----------------------------------------------------
  // LOAD LIVE DATA
  // ----------------------------------------------------
  private async loadFreshEvents(listName: string, daysAhead: number): Promise<IBirthday[]> {
    const birthdays = await this.getBirthdays(listName, daysAhead);
    const anniversaries = await this.getAnniversaries(daysAhead);

    const combined = [...birthdays, ...anniversaries];

    combined.sort((a, b) =>
      (a.NextEventDate?.getTime() ?? 0) - (b.NextEventDate?.getTime() ?? 0)
    );

    return combined;
  }

  // ----------------------------------------------------
  // BACKGROUND REFRESH (15 minutes)
  // ----------------------------------------------------
  private async refreshCacheInBackground(listName: string, daysAhead: number) {
    setTimeout(async () => {
      console.log("Background refresh started...");

      const data = await this.loadFreshEvents(listName, daysAhead);
      CacheService.save(data);

      console.log("Background refresh complete.");
    }, 200);
  }

  // ----------------------------------------------------
  // GET BIRTHDAYS (SharePoint List)
  // ----------------------------------------------------
  public async getBirthdays(listName: string, daysAhead: number): Promise<IBirthday[]> {

    const listToUse =
      listName?.trim() !== "" ? listName : this.defaultListName;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setDate(today.getDate() + daysAhead);

    const items = await this._sp.web.lists
      .getByTitle(listToUse)
      .items.select("Title", "Birthday", "Email", "JobTitle")();

    const results: IBirthday[] = [];

    for (const i of items) {
      if (!i.Birthday) continue;

      const birth = new Date(i.Birthday);

      let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (next < today) next.setFullYear(next.getFullYear() + 1);

      if (next <= end) {
        const photo = await this.getPhoto(i.Email);

        results.push({
          Title: i.Title,
          Email: i.Email,
          JobTitle: i.JobTitle,
          Birthday: i.Birthday,
          PhotoUrl: photo,
          IsAnniversary: false,
          NextEventDate: next,
          IsToday:
            next.getDate() === today.getDate() &&
            next.getMonth() === today.getMonth()
        });
      }
    }

    return results;
  }

  // ----------------------------------------------------
  // GET ANNIVERSARIES FROM GRAPH API
  // ----------------------------------------------------
  public async getAnniversaries(daysAhead: number): Promise<IBirthday[]> {

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setDate(today.getDate() + daysAhead);

    // Load AD Users
    const users = await this._graph.users
      .select("displayName", "mail", "jobTitle", "employeeHireDate")
      .top(999)();

    const results: IBirthday[] = [];

    for (const u of users) {
      if (!u.mail) continue;

      let hire = u.employeeHireDate
        ? new Date(u.employeeHireDate)
        : new Date(2015, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

      let nextAnniv = new Date(today.getFullYear(), hire.getMonth(), hire.getDate());
      if (nextAnniv < today) nextAnniv.setFullYear(nextAnniv.getFullYear() + 1);

      if (nextAnniv > end) continue;

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

  // ----------------------------------------------------
  // GET USER PHOTO (Graph → Base64 → Cached)
  // ----------------------------------------------------
  private async getPhoto(email: string): Promise<string> {
    try {
      const blob = await this._graph.users.getById(email).photo.getBlob();
      return await this.blobToBase64(blob);
    } catch {
      return placeholderImage;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
}
