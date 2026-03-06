import { IsString, IsNumber, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class AdjustBalanceDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  targetBalance: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
