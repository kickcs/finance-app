import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';

export class RegisterPushDeviceDto {
  // Expo push tokens are ~50 chars, raw APNs hex is 64, FCM ≤ 256. Capping
  // at 512 prevents a malicious client from filling the table with
  // multi-MB strings while leaving comfortable headroom for future formats.
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
