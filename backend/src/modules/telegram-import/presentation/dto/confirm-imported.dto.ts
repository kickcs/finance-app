import { IsOptional, IsUUID } from 'class-validator';

export class ConfirmImportedDto {
  @IsUUID()
  transactionId: string;

  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;
}
