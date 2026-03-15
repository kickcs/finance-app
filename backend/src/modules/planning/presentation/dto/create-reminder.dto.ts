import { IsString, IsNotEmpty, IsNumber, IsIn, IsDateString, Min, Max } from 'class-validator';

export class CreateReminderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
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
