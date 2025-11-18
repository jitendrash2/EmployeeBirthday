import { SPFI } from "@pnp/sp";
import { GraphFI } from "@pnp/graph";

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/graph/users";
import "@pnp/graph/photos";

import { IBirthday } from "../components/IBirthday";

export default class BirthdayService {

  private _sp: SPFI;
  private _graph: GraphFI;

  private defaultListName = "EmployeeBirthdays";

  constructor(sp: SPFI, graph: GraphFI) {
    this._sp = sp;
    this._graph = graph;
  }

  public async getBirthdays(listName: string, daysAhead: number): Promise<IBirthday[]> {

    const listToUse = listName?.trim() || this.defaultListName;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + daysAhead);

    const items = await this._sp.web.lists
      .getByTitle(listToUse)
      .items
      .select("Title", "Birthday", "Email", "JobTitle")();

    const uniqueMap = new Map<string, IBirthday>();

    for (const i of items) {
      const birth = new Date(i.Birthday);
      let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);

      if (next >= today && next <= endDate) {
        const photoUrl = await this.getPhoto(i.Email);

        uniqueMap.set(i.Email, {
          Title: i.Title,
          Birthday: i.Birthday,
          Email: i.Email,
          JobTitle: i.JobTitle,
          PhotoUrl: photoUrl,
          NextBirthday: next
        });
      }
    }

    return Array.from(uniqueMap.values()).sort((a, b) => {
  const dateA = a.NextBirthday ? new Date(a.NextBirthday).getTime() : 0;
  const dateB = b.NextBirthday ? new Date(b.NextBirthday).getTime() : 0;
  return dateA - dateB;
});

  }

  private async getPhoto(email: string): Promise<string> {
    try {
      const blob = await this._graph.users.getById(email).photo.getBlob();
      return URL.createObjectURL(blob);
    } catch {
      return "/_layouts/15/images/personplaceholder.png";
    }
  }
}
