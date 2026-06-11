import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsDateString()
  cursorDate?: string;

  @IsOptional()
  @IsDateString()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsUUID()
  cursorId?: string;

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

  @IsOptional()
  @IsUUID()
  debtId?: string;
}
