import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportTransactionItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note: string | null;

  @IsNumber()
  @Min(-1_000_000_000_000)
  @Max(1_000_000_000_000)
  amount: number;

  @IsString()
  @MaxLength(255)
  categoryName: string;

  @IsString()
  @MaxLength(255)
  accountName: string;

  @IsString()
  @MaxLength(10)
  currency: string;

  @IsDateString()
  date: string;
}

export class BulkImportDto {
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => ImportTransactionItemDto)
  transactions: ImportTransactionItemDto[];
}
