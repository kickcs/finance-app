import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'yearly', 'once'])
  frequency?: 'weekly' | 'monthly' | 'yearly' | 'once';

  @IsOptional()
  @IsDateString()
  nextDate?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
