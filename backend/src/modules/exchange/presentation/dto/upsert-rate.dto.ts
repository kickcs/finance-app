import { IsString, IsNumber, Length } from 'class-validator';

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
