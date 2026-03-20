import {
  IsString,
  IsNotEmpty,
  IsUUID,
  MaxLength,
  IsOptional,
  IsNumber,
  IsPositive,
  Max,
} from 'class-validator';

export class CreateQuickActionDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1_000_000_000_000)
  amount?: number;
}
