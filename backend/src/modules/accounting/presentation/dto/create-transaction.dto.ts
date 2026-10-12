import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsPositive,
  IsNotEmpty,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Вторая часть оплаты с другого счёта в валюте операции. */
export class PaymentSecondPartDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  @IsPositive({ message: 'Second part amount must be positive' })
  @Max(1_000_000_000_000)
  amount: number;
}

export class CreateTransactionDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  @Max(1_000_000_000_000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsIn(['income', 'expense', 'transfer'])
  type: 'income' | 'expense' | 'transfer';

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsBoolean()
  isDebtRelated?: boolean;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'To amount must be positive' })
  @Max(1_000_000_000_000)
  toAmount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toCurrency?: string;

  @IsOptional()
  @IsString()
  debtId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'Fee amount must be positive' })
  @Max(1_000_000_000_000)
  feeAmount?: number;

  @IsOptional()
  @IsBoolean()
  isInformational?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentSecondPartDto)
  secondPart?: PaymentSecondPartDto;
}
