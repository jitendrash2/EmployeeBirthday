export interface IBirthday {
  Title?: string;
  Birthday?: string;
  HireDate?: string;

  NextEventDate?: Date;
  DaysUntilEvent?: number;
  DaysSinceHire?: number;
  YearsCompleted?: number;
  IsAnniversary?: boolean;
  IsNewHire?: boolean;
  IsToday?: boolean;

  Email?: string;
  JobTitle?: string;
  PhotoUrl?: string;
}
