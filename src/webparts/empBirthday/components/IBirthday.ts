export interface IBirthday {
  Title: string | null;
  Birthday?: string | null;
  HireDate?: string | null;

  NextEventDate?: Date;
  YearsCompleted?: number;
  IsAnniversary?: boolean;
  IsToday?: boolean;

  Email: string | null;
  JobTitle?: string | null;
  PhotoUrl?: string;
}
