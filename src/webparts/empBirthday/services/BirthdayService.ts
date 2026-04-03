import { SPFI } from "@pnp/sp";
import { GraphFI } from "@pnp/graph";

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";

import "@pnp/graph/users";
import "@pnp/graph/photos";

import { IBirthday } from "../components/IBirthday";
import {
  EventType,
  getEventSelectionKey
} from "../helpers/EventSelectionHelper";
import CacheService from "./CacheService";

type EventRefreshCallback = (events: IBirthday[]) => void;

interface IGetAllEventsOptions {
  forceRefresh?: boolean;
  onBackgroundRefresh?: EventRefreshCallback;
}

interface IDataRequestResult {
  events: IBirthday[];
  error?: unknown;
}

export default class BirthdayService {

  private static readonly BACKGROUND_REFRESH_DELAY = 200;

  private _sp: SPFI;
  private _graph: GraphFI;

  private readonly defaultListName: string = "EmployeeBirthdays";

  constructor(sp: SPFI, graph: GraphFI) {
    this._sp = sp;
    this._graph = graph;
  }

  private getNormalizedEventTypes(selectedEventTypes: EventType[]): EventType[] {
    const normalizedEventTypes = selectedEventTypes.filter((eventType, index, source) =>
      source.indexOf(eventType) === index
    );

    return normalizedEventTypes.length > 0
      ? normalizedEventTypes
      : ["birthday", "anniversary", "newHire"];
  }

  private getCacheScope(
    listName: string,
    daysAhead: number,
    newHireDays: number,
    selectedEventTypes: EventType[]
  ): string {
    const normalizedListName = listName?.trim() || this.defaultListName;
    const selectionKey = getEventSelectionKey(
      this.getNormalizedEventTypes(selectedEventTypes)
    );

    return `${normalizedListName}::${daysAhead}::${newHireDays}::${selectionKey}`;
  }

  private getStartOfDay(date: Date): Date {
    const normalizedDate = new Date(date.getTime());

    normalizedDate.setHours(0, 0, 0, 0);

    return normalizedDate;
  }

  private getStartOfToday(): Date {
    return this.getStartOfDay(new Date());
  }

  private parseDate(value?: string | number | Date): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return this.getStartOfDay(parsed);
  }

  private getNextOccurrence(sourceDate: Date): Date {
    const today = this.getStartOfToday();
    const nextOccurrence = new Date(
      today.getFullYear(),
      sourceDate.getMonth(),
      sourceDate.getDate()
    );

    nextOccurrence.setHours(0, 0, 0, 0);

    if (nextOccurrence < today) {
      nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
    }

    return nextOccurrence;
  }

  private getDayDifference(fromDate: Date, toDate: Date): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return Math.round((toDate.getTime() - fromDate.getTime()) / millisecondsPerDay);
  }

  private hydrateCelebrationEvent(event: IBirthday): IBirthday | undefined {
    const sourceDate = event.IsAnniversary
      ? this.parseDate(event.HireDate) ?? this.parseDate(event.NextEventDate)
      : this.parseDate(event.Birthday) ?? this.parseDate(event.NextEventDate);

    if (!sourceDate) {
      return undefined;
    }

    const nextEventDate = this.getNextOccurrence(sourceDate);
    const daysUntilEvent = this.getDayDifference(this.getStartOfToday(), nextEventDate);

    return {
      ...event,
      NextEventDate: nextEventDate,
      DaysUntilEvent: daysUntilEvent,
      DaysSinceHire: undefined,
      IsToday: daysUntilEvent === 0,
      IsNewHire: false,
      YearsCompleted: event.IsAnniversary
        ? nextEventDate.getFullYear() - sourceDate.getFullYear()
        : event.YearsCompleted
    };
  }

  private hydrateNewHireEvent(event: IBirthday): IBirthday | undefined {
    const hireDate = this.parseDate(event.HireDate) ?? this.parseDate(event.NextEventDate);

    if (!hireDate) {
      return undefined;
    }

    const today = this.getStartOfToday();
    const daysSinceHire = this.getDayDifference(hireDate, today);

    if (daysSinceHire < 0) {
      return undefined;
    }

    return {
      ...event,
      HireDate: hireDate.toISOString(),
      NextEventDate: hireDate,
      DaysUntilEvent: undefined,
      DaysSinceHire: daysSinceHire,
      IsToday: daysSinceHire === 0,
      IsAnniversary: false,
      IsNewHire: true,
      YearsCompleted: undefined
    };
  }

  private hydrateEvent(event: IBirthday): IBirthday | undefined {
    if (event.IsNewHire) {
      return this.hydrateNewHireEvent(event);
    }

    return this.hydrateCelebrationEvent(event);
  }

  private sortEvents(events: IBirthday[], selectedEventTypes: EventType[]): IBirthday[] {
    const normalizedEventTypes = this.getNormalizedEventTypes(selectedEventTypes);
    const isNewHireOnly = normalizedEventTypes.length === 1 &&
      normalizedEventTypes[0] === "newHire";

    return [...events].sort((left, right) => {
      if (isNewHireOnly) {
        const hireDayDifference = (left.DaysSinceHire ?? Number.MAX_SAFE_INTEGER) - (right.DaysSinceHire ?? Number.MAX_SAFE_INTEGER);

        if (hireDayDifference !== 0) {
          return hireDayDifference;
        }

        const hireDateDifference = (right.NextEventDate?.getTime() ?? 0) - (left.NextEventDate?.getTime() ?? 0);

        if (hireDateDifference !== 0) {
          return hireDateDifference;
        }
      }

      if (Boolean(left.IsNewHire) !== Boolean(right.IsNewHire)) {
        return left.IsNewHire ? 1 : -1;
      }

      if (left.IsNewHire && right.IsNewHire) {
        const hireDayDifference = (left.DaysSinceHire ?? Number.MAX_SAFE_INTEGER) - (right.DaysSinceHire ?? Number.MAX_SAFE_INTEGER);

        if (hireDayDifference !== 0) {
          return hireDayDifference;
        }

        const hireDateDifference = (right.NextEventDate?.getTime() ?? 0) - (left.NextEventDate?.getTime() ?? 0);

        if (hireDateDifference !== 0) {
          return hireDateDifference;
        }
      } else {
        const dayDifference = (left.DaysUntilEvent ?? Number.MAX_SAFE_INTEGER) - (right.DaysUntilEvent ?? Number.MAX_SAFE_INTEGER);

        if (dayDifference !== 0) {
          return dayDifference;
        }

        const eventDateDifference = (left.NextEventDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.NextEventDate?.getTime() ?? Number.MAX_SAFE_INTEGER);

        if (eventDateDifference !== 0) {
          return eventDateDifference;
        }
      }

      return (left.Title ?? "").localeCompare(right.Title ?? "");
    });
  }

  private normalizeEvents(events: IBirthday[], selectedEventTypes: EventType[]): IBirthday[] {
    const hydratedEvents = events
      .map((event) => this.hydrateEvent(event))
      .filter((event): event is IBirthday => event !== undefined);

    return this.sortEvents(hydratedEvents, selectedEventTypes);
  }

  private getGraphEmail(mail?: string | null, userPrincipalName?: string | null): string | undefined {
    const preferredEmail = mail?.trim() || userPrincipalName?.trim();

    return preferredEmail || undefined;
  }

  public async getAllEvents(
    listName: string,
    daysAhead: number,
    newHireDays: number,
    selectedEventTypes: EventType[],
    options: IGetAllEventsOptions = {}
  ): Promise<IBirthday[]> {
    const normalizedEventTypes = this.getNormalizedEventTypes(selectedEventTypes);
    const cacheScope = this.getCacheScope(listName, daysAhead, newHireDays, normalizedEventTypes);
    const cached = CacheService.load<IBirthday[]>(cacheScope);

    if (!options.forceRefresh && cached) {
      const cachedEvents = this.normalizeEvents(cached.data, normalizedEventTypes);

      if (CacheService.isExpired(cached.timestamp)) {
        this.refreshCacheInBackground(
          listName,
          daysAhead,
          newHireDays,
          normalizedEventTypes,
          options.onBackgroundRefresh
        );
      }

      return cachedEvents;
    }

    try {
      const freshEvents = await this.loadFreshEvents(
        listName,
        daysAhead,
        newHireDays,
        normalizedEventTypes
      );

      CacheService.save(cacheScope, freshEvents);

      return freshEvents;
    } catch (error) {
      if (cached) {
        console.warn("Live employee data load failed. Falling back to cached data.", error);
        return this.normalizeEvents(cached.data, normalizedEventTypes);
      }

      throw error;
    }
  }

  private async loadFreshEvents(
    listName: string,
    daysAhead: number,
    newHireDays: number,
    selectedEventTypes: EventType[]
  ): Promise<IBirthday[]> {
    const normalizedEventTypes = this.getNormalizedEventTypes(selectedEventTypes);
    const requests: Array<Promise<IBirthday[]>> = [];

    if (normalizedEventTypes.includes("birthday")) {
      requests.push(this.getBirthdays(listName, daysAhead));
    }

    if (normalizedEventTypes.includes("anniversary")) {
      requests.push(this.getAnniversaries(daysAhead));
    }

    if (normalizedEventTypes.includes("newHire")) {
      requests.push(this.getNewHires(newHireDays));
    }

    const results = await Promise.all<IDataRequestResult>(
      requests.map((request) =>
        request
          .then((events) => ({ events }))
          .catch((error) => ({ events: [] as IBirthday[], error }))
      )
    );
    const combinedEvents = results.reduce<IBirthday[]>(
      (allEvents, result) => allEvents.concat(result.events),
      []
    );

    if (combinedEvents.length === 0) {
      const firstFailure = results.find((result) => result.error !== undefined);

      if (firstFailure?.error) {
        throw firstFailure.error;
      }
    }

    return this.normalizeEvents(combinedEvents, normalizedEventTypes);
  }

  private refreshCacheInBackground(
    listName: string,
    daysAhead: number,
    newHireDays: number,
    selectedEventTypes: EventType[],
    onBackgroundRefresh?: EventRefreshCallback
  ): void {
    const normalizedEventTypes = this.getNormalizedEventTypes(selectedEventTypes);
    const cacheScope = this.getCacheScope(listName, daysAhead, newHireDays, normalizedEventTypes);

    setTimeout(() => {
      this.loadFreshEvents(listName, daysAhead, newHireDays, normalizedEventTypes)
        .then((events) => {
          CacheService.save(cacheScope, events);
          onBackgroundRefresh?.(events);
        })
        .catch((error) => {
          console.warn("Background refresh failed.", error);
        });
    }, BirthdayService.BACKGROUND_REFRESH_DELAY);
  }

  public async getBirthdays(listName: string, daysAhead: number): Promise<IBirthday[]> {
    const listToUse = listName?.trim() || this.defaultListName;
    const today = this.getStartOfToday();
    const endDate = new Date(today);

    endDate.setDate(today.getDate() + daysAhead);

    const items = await this._sp.web.lists
      .getByTitle(listToUse)
      .items.select("Title", "Birthday", "Email", "JobTitle")();

    const results = await Promise.all(
      items.map(async (item) => {
        if (!item.Birthday) {
          return undefined;
        }

        const birthDate = this.parseDate(item.Birthday);

        if (!birthDate) {
          return undefined;
        }

        const nextEventDate = this.getNextOccurrence(birthDate);

        if (nextEventDate > endDate) {
          return undefined;
        }

        const photo = item.Email
          ? await this.getPhoto(item.Email)
          : undefined;

        return this.hydrateEvent({
          Title: item.Title,
          Email: item.Email,
          JobTitle: item.JobTitle,
          Birthday: item.Birthday,
          PhotoUrl: photo,
          IsAnniversary: false,
          IsNewHire: false,
          NextEventDate: nextEventDate
        });
      })
    );

    return results.filter((event): event is IBirthday => event !== undefined);
  }

  public async getAnniversaries(daysAhead: number): Promise<IBirthday[]> {
    const today = this.getStartOfToday();
    const endDate = new Date(today);

    endDate.setDate(today.getDate() + daysAhead);

    const users = await this._graph.users
      .select("displayName", "mail", "userPrincipalName", "jobTitle", "employeeHireDate")
      .top(999)();

    const results = await Promise.all(
      users.map(async (user) => {
        if (!user.employeeHireDate) {
          return undefined;
        }

        const hireDate = this.parseDate(user.employeeHireDate);
        const email = this.getGraphEmail(user.mail, user.userPrincipalName);

        if (!hireDate || !email) {
          return undefined;
        }

        const nextAnniversary = this.getNextOccurrence(hireDate);

        if (nextAnniversary < today || nextAnniversary > endDate) {
          return undefined;
        }

        const photo = await this.getPhoto(email);

        return this.hydrateEvent({
          Title: user.displayName ?? "Unknown User",
          Email: email,
          JobTitle: user.jobTitle ?? "",
          HireDate: hireDate.toISOString(),
          PhotoUrl: photo,
          IsAnniversary: true,
          IsNewHire: false,
          NextEventDate: nextAnniversary
        });
      })
    );

    return results.filter((event): event is IBirthday => event !== undefined);
  }

  public async getNewHires(newHireDays: number): Promise<IBirthday[]> {
    const today = this.getStartOfToday();
    const startDate = new Date(today);

    startDate.setDate(today.getDate() - newHireDays);

    const users = await this._graph.users
      .select("displayName", "mail", "userPrincipalName", "jobTitle", "employeeHireDate")
      .top(999)();

    const results = await Promise.all(
      users.map(async (user) => {
        if (!user.employeeHireDate) {
          return undefined;
        }

        const hireDate = this.parseDate(user.employeeHireDate);
        const email = this.getGraphEmail(user.mail, user.userPrincipalName);

        if (!hireDate || !email || hireDate < startDate || hireDate > today) {
          return undefined;
        }

        const photo = await this.getPhoto(email);

        return this.hydrateEvent({
          Title: user.displayName ?? "Unknown User",
          Email: email,
          JobTitle: user.jobTitle ?? "",
          HireDate: hireDate.toISOString(),
          PhotoUrl: photo,
          IsAnniversary: false,
          IsNewHire: true,
          NextEventDate: hireDate
        });
      })
    );

    return results.filter((event): event is IBirthday => event !== undefined);
  }

  private async getPhoto(email: string): Promise<string | undefined> {
    try {
      const blob = await this._graph.users.getById(email).photo.getBlob();
      return await this.blobToBase64(blob);
    } catch {
      return undefined;
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
