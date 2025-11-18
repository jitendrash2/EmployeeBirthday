import { SPFI } from "@pnp/sp";
import { GraphFI } from "@pnp/graph";

export interface IEmpBirthdayWebPartProps {
  description: string;
  listName: string;
  daysAhead: number;
  backgroundImage: string;
  sp: SPFI;
  graph: GraphFI;
}
