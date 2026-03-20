import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsNumber,
  IsPositive,
  ValidateIf,
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
  amount?: number | null;
}
