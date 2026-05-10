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
  ArrayUnique,
  ArrayMaxSize,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

const MIN_BILLING_DATE = new Date('2000-01-01T00:00:00.000Z');
const MAX_BILLING_DATE_YEARS = 10;

@ValidatorConstraint({ name: 'isReasonableDate', async: false })
export class IsReasonableDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed < MIN_BILLING_DATE) return false;
    const maxDate = new Date();
    maxDate.setUTCFullYear(maxDate.getUTCFullYear() + MAX_BILLING_DATE_YEARS);
    if (parsed > maxDate) return false;
    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return `billingDate must be between ${MIN_BILLING_DATE.toISOString().slice(0, 10)} and +${MAX_BILLING_DATE_YEARS} years from now`;
  }
}

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

  @ValidateIf((dto: CreateSubscriptionDto) => dto.frequency === 'custom')
  @IsInt()
  @Min(1)
  @Max(3650)
  frequencyDays?: number;

  @IsDateString()
  @Validate(IsReasonableDateConstraint)
  billingDate: string;

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
