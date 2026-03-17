import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  totalAmount: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  remainingAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
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

  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
