import { IsString, IsNumber, IsArray, IsUUID, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class GetByAccountIdsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  accountIds: string[];
}

export class UpsertBalanceDto {
  @IsUUID()
  accountId: string;

  @IsString()
  currency: string;

  @IsNumber()
  balance: number;
}

export class BalanceItemDto {
  @IsString()
  currency: string;

  @IsNumber()
  balance: number;
}

export class CreateManyBalancesDto {
  @IsUUID()
  accountId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceItemDto)
  @ArrayMinSize(1)
  balances: BalanceItemDto[];
}

export class UpdateByDeltaDto {
  @IsUUID()
  accountId: string;

  @IsString()
  currency: string;

  @IsNumber()
  delta: number;
}
