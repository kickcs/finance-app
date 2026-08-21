import { IsString, MaxLength, MinLength } from 'class-validator';

export class OffsetDebtsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  personName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;
}
