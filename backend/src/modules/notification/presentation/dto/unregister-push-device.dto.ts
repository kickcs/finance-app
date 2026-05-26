import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UnregisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
