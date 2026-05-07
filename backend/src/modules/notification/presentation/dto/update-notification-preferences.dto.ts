import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  subscriptionUpcoming?: boolean;

  @IsOptional()
  @IsBoolean()
  subscriptionCharged?: boolean;

  @IsOptional()
  @IsBoolean()
  subscriptionFailed?: boolean;
}
