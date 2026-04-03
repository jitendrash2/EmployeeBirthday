import { SPFI } from "@pnp/sp";
import { GraphFI } from "@pnp/graph";
import { BackgroundVariant } from "../helpers/VisualHelper";
import { EventType } from "../helpers/EventSelectionHelper";

export interface IEmpBirthdayProps {
  description: string;
  heroEyebrowText?: string;
  heroSubtitleText?: string;
  heroHighlightText?: string;
  listName: string;
  daysAhead: number;
  newHireDays: number;
  backgroundVariant?: BackgroundVariant;
  backgroundImage?: string;
  selectedEventTypes: EventType[];

  sp: SPFI;
  graph: GraphFI;
}
