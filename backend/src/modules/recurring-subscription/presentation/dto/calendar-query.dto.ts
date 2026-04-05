import { IsString, Matches } from 'class-validator';

export class CalendarQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in format YYYY-MM' })
  month: string;
}
