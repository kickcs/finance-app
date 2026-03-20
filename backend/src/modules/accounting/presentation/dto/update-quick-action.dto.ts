import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsNumber,
  IsPositive,
  ValidateIf,
  Max,
} from 'class-validator';

export class UpdateQuickActionDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber()
  @IsPositive()
  @Max(1_000_000_000_000)
  amount?: number | null;
}
