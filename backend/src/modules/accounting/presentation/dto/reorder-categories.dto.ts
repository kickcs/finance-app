import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderCategoriesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categoryIds: string[];
}
