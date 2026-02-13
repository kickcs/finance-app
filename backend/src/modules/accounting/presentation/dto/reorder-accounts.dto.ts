import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderAccountsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  accountIds: string[];
}
