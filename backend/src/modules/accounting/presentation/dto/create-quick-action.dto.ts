import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateQuickActionDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsString()
  @MaxLength(50)
  label: string;
}
