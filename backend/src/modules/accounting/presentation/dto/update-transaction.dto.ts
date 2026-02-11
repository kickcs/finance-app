import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsPositive,
} from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'Amount must be positive' })
  amount?: number;

  @IsOptional()
  @IsString()
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
  @IsUUID()
  toAccountId?: string | null;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'To amount must be positive' })
  toAmount?: number | null;

  @IsOptional()
  @IsString()
  toCurrency?: string | null;
}
