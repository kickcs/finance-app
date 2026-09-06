import {
  IsNumber,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class PayDebtDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  amount!: number;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  forgiveRemainder?: boolean;

  /** Категории долгов строковые (`debt_return_to_me`), поэтому не UUID. */
  @IsOptional()
  @IsString()
  excessCategoryId?: string;

  /** Отработка: долг гасится работой, деньги по счетам не двигаются. */
  @IsOptional()
  @IsBoolean()
  settleWithWork?: boolean;

  /** Что отработано — короткая заметка в описание отметки. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workNote?: string;

  /** Категория работы: с ней отработка попадает в аналитику тратой/доходом. */
  @IsOptional()
  @IsString()
  workCategoryId?: string;
}
