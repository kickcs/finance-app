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
  @ValidateIf((o: UpdateAccountDto) => o.creditLimit !== null)
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.gracePeriodDays !== null)
  @IsInt()
  @Min(1)
  @Max(365)
  gracePeriodDays?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.billingDay !== null)
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay?: number | null;

  // Loan fields
  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.totalAmount !== null)
  @IsNumber()
  @Min(0)
  totalAmount?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.interestRate !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.monthlyPayment !== null)
  @IsNumber()
  @Min(0)
  monthlyPayment?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.startDate !== null)
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.endDate !== null)
  @IsDateString()
  endDate?: string | null;

  // Deposit fields
  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.maturityDate !== null)
  @IsDateString()
  maturityDate?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.isReplenishable !== null)
  @IsBoolean()
  isReplenishable?: boolean | null;

  @IsOptional()
  @ValidateIf((o: UpdateAccountDto) => o.isWithdrawable !== null)
  @IsBoolean()
  isWithdrawable?: boolean | null;
}
