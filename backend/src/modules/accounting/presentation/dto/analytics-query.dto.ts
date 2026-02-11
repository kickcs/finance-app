import { IsString, IsOptional, IsDateString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => {
    // Handle both comma-separated string and array
    if (typeof value === 'string') {
      return value.split(',').filter(Boolean);
    }
    return value;
  })
  accountIds?: string[];
}
