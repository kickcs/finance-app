import {
  IsString,
  IsNotEmpty,
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
