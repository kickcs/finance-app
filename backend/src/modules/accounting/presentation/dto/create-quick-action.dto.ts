import { IsString, IsUUID, MaxLength, IsOptional, IsNumber, IsPositive } from 'class-validator';

export class CreateQuickActionDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsString()
  @MaxLength(50)
  label: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
