import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { IsAllowedPushEndpoint } from '../validators/is-allowed-push-endpoint.validator';

export class RegisterPushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @IsAllowedPushEndpoint()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
