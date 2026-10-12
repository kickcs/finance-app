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
import { PaymentSecondPartDto } from './create-transaction.dto';

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  @Max(1_000_000_000_000)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currency?: string;

  @IsOptional()
  @IsIn(['income', 'expense', 'transfer'])
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  isDebtRelated?: boolean;

  @IsOptional()
  @IsString()
  debtId?: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string | null;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'To amount must be positive' })
  @Max(1_000_000_000_000)
  toAmount?: number | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  toCurrency?: string | null;

  /** `null` убирает вторую часть оплаты, отсутствие поля её не трогает. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentSecondPartDto)
  secondPart?: PaymentSecondPartDto | null;
}
