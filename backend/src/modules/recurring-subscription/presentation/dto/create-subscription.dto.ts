import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  @IsNotEmpty()
  icon: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsIn(['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
  frequency: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyDays?: number;

  @IsDateString()
  billingDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  notifyDaysBefore?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  autoCharge?: boolean;
}
