import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Предпросмотр считает план по долгам и сумме: счёт, переплата и дата нужны только исполнению. */
export class PreviewCloseAllDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  debtIds!: string[];

  /** Ноль допустим: с `forgiveRemainder` это закрытие одним прощением. `null` значит «не задана». */
  @Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  paymentAmount?: number;

  @IsOptional()
  @IsBoolean()
  forgiveRemainder?: boolean;
}

export class CloseAllDebtsDto extends PreviewCloseAllDto {
  @IsUUID()
  accountId!: string;

  /** Категории долгов строковые (`debt_return_to_me`), поэтому не UUID. */
  @IsOptional()
  @IsString()
  excessCategoryId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
