import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
  IsInt,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class BalanceDto {
  @IsString()
  currency: string;

  @IsNumber()
  balance: number;
}

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsIn(['basic', 'savings', 'credit_card', 'cash', 'loan', 'deposit'])
  type?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceDto)
  balances?: BalanceDto[];

  // Credit card fields
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  gracePeriodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay?: number;

  // Loan fields
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPayment?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // Deposit fields
  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @IsOptional()
  @IsBoolean()
  isReplenishable?: boolean;

  @IsOptional()
  @IsBoolean()
  isWithdrawable?: boolean;
}
