import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  remainingAmount?: number;

  @IsOptional()
  @IsNumber()
  monthlyPayment?: number | null;

  @IsOptional()
  @IsDateString()
  nextPaymentDate?: string | null;

  @IsOptional()
  @IsIn(['given', 'taken'])
  debtType?: string;

  @IsOptional()
  @IsString()
  personName?: string | null;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsUUID()
  transactionId?: string | null;

  @IsOptional()
  @IsUUID()
  closeTransactionId?: string | null;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  sourceTransactionId?: string | null;
}
