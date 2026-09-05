import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class SharedDebtEntryDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsIn(['given', 'taken'])
  direction: 'given' | 'taken';

  @IsString()
  @MaxLength(10)
  currency: string;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  remainingAmount: number;

  @IsNumber()
  paidAmount: number;

  @IsNumber()
  forgivenAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dueDate: string | null;

  @IsString()
  @MaxLength(40)
  createdAt: string;
}

export class ShareDebtsDto {
  @IsString()
  @MaxLength(100)
  personName: string;

  @IsString()
  @MaxLength(10)
  currency: string;

  @IsNumber()
  net: number;

  @IsNumber()
  totalGiven: number;

  @IsNumber()
  totalTaken: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName: string | null;

  @IsInt()
  snapshotAt: number;

  /** Карта получателя перевода — только цифры, как и в профиле. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{12,19}$/, { message: 'cardNumber must contain between 12 and 19 digits' })
  cardNumber?: string | null;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SharedDebtEntryDto)
  debts: SharedDebtEntryDto[];
}
