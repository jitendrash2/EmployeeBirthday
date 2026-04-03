import { IBirthday } from "./IBirthday";
import { BackgroundVariant } from "../helpers/VisualHelper";

export interface IEventModalProps {
  event: IBirthday;
  onClose: () => void;
  backgroundVariant: BackgroundVariant;
}
