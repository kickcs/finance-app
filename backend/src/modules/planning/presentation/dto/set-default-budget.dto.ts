import { IsNumber, Min, Max } from 'class-validator';

export class SetDefaultBudgetDto {
  @IsNumber()
  @Min(1)
  @Max(1_000_000_000_000)
  amount: number;
}
