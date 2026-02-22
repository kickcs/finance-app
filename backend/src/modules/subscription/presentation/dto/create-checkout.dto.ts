import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['premium_monthly', 'premium_yearly'])
  plan: 'premium_monthly' | 'premium_yearly';
}
