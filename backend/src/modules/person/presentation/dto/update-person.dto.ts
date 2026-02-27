import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
