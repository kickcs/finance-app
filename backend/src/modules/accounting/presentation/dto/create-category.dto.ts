import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsIn(['income', 'expense'])
  type: 'income' | 'expense';

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
