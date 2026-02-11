import { IsString, IsNumber, IsIn, IsDateString, Min } from 'class-validator';

export class CreateReminderDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn(['weekly', 'monthly', 'yearly', 'once'])
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once';

  @IsDateString()
  nextDate: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;
}
