import {
  IsString,
  IsOptional,
  Matches,
  IsBoolean,
  IsUUID,
  IsArray,
  IsObject,
  IsInt,
  IsIn,
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
  @IsIn(['ru', 'en'])
  language?: string;

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

  /** Только цифры: форматирование — дело клиента, здесь хранится голый номер. `null` очищает карту. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{12,19}$/, { message: 'paymentCardNumber must contain between 12 and 19 digits' })
  paymentCardNumber?: string | null;
}
