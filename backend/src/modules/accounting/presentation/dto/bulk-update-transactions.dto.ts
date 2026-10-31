import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionFilterDto } from './pagination.dto';
import {
  BULK_ACTION_KINDS,
  type BulkActionKind,
} from '../../application/commands/bulk-update-transactions/bulk-update-transactions.command';

/**
 * Выборка: `ids` или `filter` со сверкой (`asOf`, `expectedCount`); что пришло ровно одно, проверяет
 * контроллер. Предел `ids` — в обработчике: ValidationPipe приклеил бы к тексту путь `selection.`.
 */
export class BulkSelectionDto {
  @ValidateIf((o: BulkSelectionDto) => o.ids !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  ids?: string[];

  @ValidateIf((o: BulkSelectionDto) => o.filter !== undefined || o.ids === undefined)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => TransactionFilterDto)
  filter?: TransactionFilterDto;

  @ValidateIf((o: BulkSelectionDto) => o.filter !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T/, { message: 'asOf must include a time' })
  asOf?: string;

  @ValidateIf((o: BulkSelectionDto) => o.filter !== undefined)
  @IsInt()
  @Min(0)
  expectedCount?: number;
}

export class BulkActionDto {
  @IsIn(BULK_ACTION_KINDS)
  kind: BulkActionKind;

  @ValidateIf((o: BulkActionDto) => o.kind === 'category')
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ValidateIf((o: BulkActionDto) => o.kind === 'transfer')
  @IsUUID()
  toAccountId?: string;

  @ValidateIf((o: BulkActionDto) => o.kind === 'account')
  @IsUUID()
  accountId?: string;

  @ValidateIf((o: BulkActionDto) => o.kind === 'tag')
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tag?: string;
}

export class BulkUpdateTransactionsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => BulkSelectionDto)
  selection: BulkSelectionDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => BulkActionDto)
  action: BulkActionDto;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class UndoBulkUpdateDto {
  @IsString()
  @IsNotEmpty()
  undoToken: string;
}
