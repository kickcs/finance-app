import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class AccountPaginationDto {
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
}
