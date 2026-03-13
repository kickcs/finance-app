import { IsNumber, Min } from 'class-validator';

export class SetDefaultBudgetDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
