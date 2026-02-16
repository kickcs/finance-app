import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ImportTransactionItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note: string | null;

  @IsNumber()
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
