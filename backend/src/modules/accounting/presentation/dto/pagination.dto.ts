import { IsString, IsNumber, IsOptional, IsIn, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  cursorDate?: string;

  @IsOptional()
  @IsString()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsIn(['income', 'expense', 'transfer', 'debt'])
  type?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
