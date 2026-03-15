import {
  IsString,
  IsNumber,
  IsArray,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
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
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @Min(-1_000_000_000_000)
  @Max(1_000_000_000_000)
  balance: number;
}

export class BalanceItemDto {
  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @Min(-1_000_000_000_000)
  @Max(1_000_000_000_000)
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
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @Min(-1_000_000_000_000)
  @Max(1_000_000_000_000)
  delta: number;
}
