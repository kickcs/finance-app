import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsNumber()
  @Min(0)
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
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @IsOptional()
  @IsUUID()
  sourceTransactionId?: string;
}
