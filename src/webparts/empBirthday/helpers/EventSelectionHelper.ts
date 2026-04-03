export type EventType = "birthday" | "anniversary" | "newHire";

export interface IEventSelectionConfig {
  eventFilter?: string;
  showAllCards?: boolean;
  showBirthdays?: boolean;
  showAnniversaries?: boolean;
  showNewHires?: boolean;
}

export const allEventTypes: EventType[] = [
  "birthday",
  "anniversary",
  "newHire"
];

function getLegacySelectedEventTypes(eventFilter?: string): EventType[] {
  if (eventFilter === "birthday") {
    return ["birthday"];
  }

  if (eventFilter === "anniversary") {
    return ["anniversary"];
  }

  if (eventFilter === "newHire") {
    return ["newHire"];
  }

  return [...allEventTypes];
}

export function getSelectedEventTypes(config: IEventSelectionConfig): EventType[] {
  if (config.showAllCards) {
    return [...allEventTypes];
  }

  const selectedEventTypes = allEventTypes.filter((eventType) => {
    if (eventType === "birthday") {
      return Boolean(config.showBirthdays);
    }

    if (eventType === "anniversary") {
      return Boolean(config.showAnniversaries);
    }

    return Boolean(config.showNewHires);
  });

  if (selectedEventTypes.length > 0) {
    return selectedEventTypes;
  }

  return getLegacySelectedEventTypes(config.eventFilter);
}

export function areAllEventTypesSelected(eventTypes: EventType[]): boolean {
  return allEventTypes.every((eventType) => eventTypes.includes(eventType));
}

export function getEventSelectionKey(eventTypes: EventType[]): string {
  return [...eventTypes].sort().join("|");
}
