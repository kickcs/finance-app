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
} from 'class-validator';

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
}
