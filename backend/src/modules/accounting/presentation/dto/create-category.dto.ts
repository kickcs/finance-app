import { IsString, IsOptional, IsNumber, IsIn, IsBoolean } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  isFrequent?: boolean;
}
