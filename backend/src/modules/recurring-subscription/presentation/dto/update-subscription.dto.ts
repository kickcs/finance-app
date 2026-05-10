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
  ArrayUnique,
  ArrayMaxSize,
  Validate,
  ValidateIf,
} from 'class-validator';
import { IsReasonableDateConstraint } from './create-subscription.dto';

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

  // Required when frequency is being set to 'custom'; otherwise null/undefined OK.
  @ValidateIf((dto: UpdateSubscriptionDto, value) => dto.frequency === 'custom' || value !== null)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  frequencyDays?: number | null;

  @IsOptional()
  @IsDateString()
  @Validate(IsReasonableDateConstraint)
  billingDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(90, { each: true })
  notifyDaysBefore?: number[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  autoCharge?: boolean;
}
