import { IsDateString, IsOptional, IsArray, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class DailyStatsQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.split(',').filter(Boolean);
    }
    return value;
  })
  accountIds?: string[];

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}
