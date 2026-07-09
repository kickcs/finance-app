import { IsString, MaxLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @MaxLength(50)
  label: string;

  @IsString()
  @MaxLength(100)
  value: string;
}
