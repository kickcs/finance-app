import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateDebtDto {
  @IsString()
  name: string;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  remainingAmount: number;

  @IsOptional()
  @IsNumber()
  monthlyPayment?: number;

  @IsOptional()
  @IsDateString()
  nextPaymentDate?: string;

  @IsIn(['given', 'taken'])
  debtType: 'given' | 'taken';

  @IsOptional()
  @IsString()
  personName?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @IsOptional()
  @IsUUID()
  sourceTransactionId?: string;
}
