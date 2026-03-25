import { IsString, IsNumber, IsOptional, IsIn, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDebtsPaginatedDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;

  @IsOptional()
  @IsString()
  cursorPersonName?: string;

  @IsOptional()
  @IsIn(['given', 'taken'])
  cursorDebtType?: string;

  @IsOptional()
  @IsString()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsIn(['active', 'closed'])
  status?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  personName?: string;
}
