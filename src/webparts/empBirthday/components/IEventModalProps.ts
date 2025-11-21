import { IBirthday } from "./IBirthday";

export interface IEventModalProps {
  event: IBirthday;
  onClose: () => void;
  placeholderImage: string;
  backgroundImage?: string;
}
