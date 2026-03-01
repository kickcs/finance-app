import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

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
}
