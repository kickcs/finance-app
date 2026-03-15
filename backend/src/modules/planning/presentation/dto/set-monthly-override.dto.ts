import { IsNumber, Min, Max } from 'class-validator';

export class SetMonthlyOverrideDto {
  @IsNumber()
  @Min(2000)
  year: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(1)
  @Max(1_000_000_000_000)
  amount: number;
}
