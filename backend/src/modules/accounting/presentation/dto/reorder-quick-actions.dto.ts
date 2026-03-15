import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderQuickActionsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  ids: string[];
}
