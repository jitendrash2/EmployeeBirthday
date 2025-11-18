export interface IFormattedBirthday {
  label: string;
  age: number;
  isToday: boolean;
  isTomorrow: boolean;
}

export function formatBirthday(dateInput: string | number | Date): IFormattedBirthday {
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

  const tomorrow = new Date(today.getTime());
  tomorrow.setDate(today.getDate() + 1);

  const isToday = birthdayThisYear.getTime() === today.getTime();
  const isTomorrow = birthdayThisYear.getTime() === tomorrow.getTime();

  let label = birthdayThisYear.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit"
  });

  if (isToday) label = "Today";
  if (isTomorrow) label = "Tomorrow";

  // Age = year difference
  const age = today.getFullYear() - date.getFullYear();

  return { label, age, isToday, isTomorrow };
}
