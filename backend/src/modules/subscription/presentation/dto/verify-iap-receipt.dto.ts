import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyIapReceiptDto {
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  productId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  transactionId: string;

  // Apple StoreKit2 JWS receipts are ~2-4KB; Play Billing tokens are smaller.
  // 16KB upper bound keeps abusive payloads off the validator.
  @IsString()
  @MinLength(1)
  @MaxLength(16384)
  receipt: string;
}
