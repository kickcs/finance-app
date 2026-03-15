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
} from 'class-validator';

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  remainingAmount?: number;

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
  @IsUUID()
  sourceTransactionId?: string | null;
}
