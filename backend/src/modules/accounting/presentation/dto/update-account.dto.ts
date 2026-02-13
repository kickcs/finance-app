import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsInt,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['basic', 'savings', 'credit_card', 'cash', 'loan', 'deposit'])
  type?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  // Credit card fields
  @IsOptional()
  @ValidateIf((o) => o.creditLimit !== null)
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.gracePeriodDays !== null)
  @IsInt()
  @Min(1)
  @Max(365)
  gracePeriodDays?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.billingDay !== null)
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay?: number | null;

  // Loan fields
  @IsOptional()
  @ValidateIf((o) => o.totalAmount !== null)
  @IsNumber()
  @Min(0)
  totalAmount?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.interestRate !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.monthlyPayment !== null)
  @IsNumber()
  @Min(0)
  monthlyPayment?: number | null;

  @IsOptional()
  @ValidateIf((o) => o.startDate !== null)
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.endDate !== null)
  @IsDateString()
  endDate?: string | null;

  // Deposit fields
  @IsOptional()
  @ValidateIf((o) => o.maturityDate !== null)
  @IsDateString()
  maturityDate?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.isReplenishable !== null)
  @IsBoolean()
  isReplenishable?: boolean | null;

  @IsOptional()
  @ValidateIf((o) => o.isWithdrawable !== null)
  @IsBoolean()
  isWithdrawable?: boolean | null;
}
