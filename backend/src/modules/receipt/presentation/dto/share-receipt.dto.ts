import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';

class ChargeDisplayDto {
  @IsString()
  @MaxLength(50)
  label: string;

  @IsString()
  @MaxLength(50)
  display: string;
}

class ParticipantItemDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNumber()
  share: number;

  @IsInt()
  sharedWith: number;

  @IsNumber()
  lineTotal: number;
}

class ParticipantDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  color: string;

  @IsBoolean()
  isMe: boolean;

  @IsNumber()
  total: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paidByName: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ParticipantItemDto)
  items: ParticipantItemDto[];
}

class PaymentMethodDto {
  @IsString()
  @MaxLength(50)
  label: string;

  @IsString()
  @MaxLength(100)
  value: string;
}

export class ShareReceiptDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  storeName: string | null;

  @IsNumber()
  date: number;

  @IsString()
  @MaxLength(10)
  currency: string;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  subtotal: number;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChargeDisplayDto)
  charges: ChargeDisplayDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants: ParticipantDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods: PaymentMethodDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName: string | null;
}
