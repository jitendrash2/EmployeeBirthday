import { BackgroundVariant } from "./helpers/VisualHelper";

export interface IEmpBirthdayWebPartProps {
  description: string;
  heroEyebrowText?: string;
  heroSubtitleText?: string;
  heroHighlightText?: string;
  listName: string;
  daysAhead: number;
  newHireDays: number;
  backgroundVariant?: BackgroundVariant;
  backgroundImage?: string;
  eventFilter?: string;
  showAllCards?: boolean;
  showBirthdays?: boolean;
  showAnniversaries?: boolean;
  showNewHires?: boolean;
}
