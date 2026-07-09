import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../../../../common';
import { PaymentMethodService } from '../../application/services/payment-method.service';
import { CreatePaymentMethodDto } from '../dto';

interface PaymentMethodResponse {
  id: string;
  label: string;
  value: string;
  createdAt: Date;
}

@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<PaymentMethodResponse[]> {
    return this.paymentMethodService.findAllByUser(userId);
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponse> {
    return this.paymentMethodService.create(userId, dto.label, dto.value);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.paymentMethodService.delete(userId, id);
  }
}
