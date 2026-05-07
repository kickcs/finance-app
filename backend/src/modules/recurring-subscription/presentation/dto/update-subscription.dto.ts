import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  IsDateString,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
  frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyDays?: number | null;

  @IsOptional()
  @IsDateString()
  billingDate?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  notifyDaysBefore?: number[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  autoCharge?: boolean;
}
