import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
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
  @MaxLength(200)
  personName?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
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
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
