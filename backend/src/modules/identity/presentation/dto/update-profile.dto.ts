import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import type { DashboardSettings } from '../../domain/entities/profile.entity';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  @IsOptional()
  @IsUUID()
  defaultAccountId?: string | null;

  @IsOptional()
  dashboardSettings?: DashboardSettings | null;
}
