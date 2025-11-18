export function formatBirthday(dateInput: string | number | Date): string {

  let date: Date;

  if (dateInput instanceof Date) {
    date = new Date(dateInput.getTime());
  } else {
    date = new Date(dateInput);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const birthdayThisYear = new Date(
    today.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  birthdayThisYear.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (
    birthdayThisYear.getDate() === today.getDate() &&
    birthdayThisYear.getMonth() === today.getMonth()
  ) {
    return "Today";
  }

  if (
    birthdayThisYear.getDate() === tomorrow.getDate() &&
    birthdayThisYear.getMonth() === tomorrow.getMonth()
  ) {
    return "Tomorrow";
  }

  return birthdayThisYear.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit"
  });
}
