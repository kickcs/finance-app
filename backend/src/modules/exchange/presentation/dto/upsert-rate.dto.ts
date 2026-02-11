import { IsString, IsNumber, IsPositive, Length } from 'class-validator';

export class UpsertRateDto {
  @IsString()
  @Length(3, 3, { message: 'Base currency must be a 3-character ISO code' })
  baseCurrency: string;

  @IsString()
  @Length(3, 3, { message: 'Target currency must be a 3-character ISO code' })
  targetCurrency: string;

  @IsNumber()
  @IsPositive({ message: 'Rate must be a positive number' })
  rate: number;
}

export class ConvertAmountDto {
  @IsNumber()
  amount: number;

  @IsString()
  @Length(3, 3, { message: 'From currency must be a 3-character ISO code' })
  fromCurrency: string;

  @IsString()
  @Length(3, 3, { message: 'To currency must be a 3-character ISO code' })
  toCurrency: string;
}
