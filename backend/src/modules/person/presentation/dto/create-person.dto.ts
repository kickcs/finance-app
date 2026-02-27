import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  color?: string;
}
