import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  IsObject,
  IsInt,
  Min,
  Max,
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
  @IsObject()
  @ValidateNested()
  @Type(() => DashboardSettingsDto)
  dashboardSettings?: DashboardSettingsDto | null;

  @IsOptional()
  @IsBoolean()
  quickActionsHidden?: boolean;

  @IsOptional()
  @IsBoolean()
  quickActionsHintDismissed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  financialMonthStartDay?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  notificationHour?: number;
}
