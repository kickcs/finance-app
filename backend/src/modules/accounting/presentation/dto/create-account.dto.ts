import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class BalanceDto {
  @IsString()
  currency: string;

  @IsNumber()
  balance: number;
}

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsString()
  icon: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsIn(['basic', 'savings'])
  type?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceDto)
  balances?: BalanceDto[];
}
