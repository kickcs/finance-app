import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';

export class AdjustBalanceDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  @Min(-1_000_000_000_000)
  @Max(1_000_000_000_000)
  targetBalance: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
