import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

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
}
