export function formatAnniversary(dateInput: string | number | Date): string {

  let date: Date;

  if (dateInput instanceof Date) {
    date = new Date(dateInput.getTime());
  } else {
    date = new Date(dateInput);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const annivThisYear = new Date(
    today.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  annivThisYear.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (
    annivThisYear.getDate() === today.getDate() &&
    annivThisYear.getMonth() === today.getMonth()
  ) {
    return "Today";
  }

  if (
    annivThisYear.getDate() === tomorrow.getDate() &&
    annivThisYear.getMonth() === tomorrow.getMonth()
  ) {
    return "Tomorrow";
  }

  return annivThisYear.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit"
  });
}

export function formatYearsCompleted(years: number): string {
  if (years === 1) return "1 Year Completed!";
  return `${years} Years Completed!`;
}
