import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsIn(['basic', 'savings'])
  type?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}
