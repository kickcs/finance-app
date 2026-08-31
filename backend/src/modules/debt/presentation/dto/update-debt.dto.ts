import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  IsDateString,
  ValidateIf,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  totalAmount?: number;

  @IsOptional()
  @ValidateIf((o: UpdateDebtDto) => o.monthlyPayment !== null)
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  monthlyPayment?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateDebtDto) => o.nextPaymentDate !== null)
  @IsDateString()
  nextPaymentDate?: string | null;

  @IsOptional()
  @IsIn(['given', 'taken'])
  debtType?: 'given' | 'taken';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  personName?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateDebtDto) => o.accountId !== null)
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateDebtDto) => o.transactionId !== null)
  @IsUUID()
  transactionId?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateDebtDto) => o.sourceTransactionId !== null)
  @IsUUID()
  sourceTransactionId?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateDebtDto) => o.description !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}
