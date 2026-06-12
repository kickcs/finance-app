import { IsUUID } from 'class-validator';

export class SetCardMappingDto {
  @IsUUID()
  accountId: string;
}
