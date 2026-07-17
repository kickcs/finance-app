import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TmaAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  initData!: string;
}
