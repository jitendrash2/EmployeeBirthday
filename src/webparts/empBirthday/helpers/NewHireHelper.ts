function getNormalizedDate(dateInput: string | number | Date): Date {
  const date = dateInput instanceof Date
    ? new Date(dateInput.getTime())
    : new Date(dateInput);

  date.setHours(0, 0, 0, 0);

  return date;
}

export function formatNewHireDate(dateInput: string | number | Date): string {
  const hireDate = getNormalizedDate(dateInput);
  const today = getNormalizedDate(new Date());
  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  if (hireDate.getTime() === today.getTime()) {
    return "Joined Today";
  }

  if (hireDate.getTime() === yesterday.getTime()) {
    return "Joined Yesterday";
  }

  return `Joined ${hireDate.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit"
  })}`;
}

export function formatDaysOnTeam(daysSinceHire: number): string {
  if (daysSinceHire <= 0) {
    return "First day on the team";
  }

  if (daysSinceHire === 1) {
    return "1 day on the team";
  }

  return `${daysSinceHire} days on the team`;
}

export function formatJoinedAgo(daysSinceHire: number): string {
  if (daysSinceHire <= 0) {
    return "joined today";
  }

  if (daysSinceHire === 1) {
    return "joined 1 day ago";
  }

  return `joined ${daysSinceHire} days ago`;
}
