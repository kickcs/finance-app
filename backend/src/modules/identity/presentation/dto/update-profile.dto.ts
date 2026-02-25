import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { WidgetId } from '../../domain/entities/profile.entity';

class DashboardSettingsDto {
  @IsArray()
  @IsString({ each: true })
  widgetOrder: WidgetId[];

  @IsArray()
  @IsString({ each: true })
  hiddenWidgets: WidgetId[];

  @IsArray()
  @IsString({ each: true })
  hiddenAccountIds: string[];
}

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
  @ValidateNested()
  @Type(() => DashboardSettingsDto)
  dashboardSettings?: DashboardSettingsDto | null;
}
