import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ConvertAmountDto } from '../dto';
import { GetRateQuery, GetBatchRatesQuery, ConvertAmountQuery } from '../../application/queries';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * Get all exchange rates for a base currency in one request
   * GET /exchange-rates/batch?base=UZS
   */
  @Get('batch')
  async getBatchRates(@Query('base') baseCurrency: string): Promise<unknown> {
    return this.queryBus.execute(new GetBatchRatesQuery(baseCurrency));
  }

  /**
   * Get exchange rate for a currency pair
   * GET /exchange-rates/:baseCurrency/:targetCurrency
   */
  @Get(':baseCurrency/:targetCurrency')
  async getRate(
    @Param('baseCurrency') baseCurrency: string,
    @Param('targetCurrency') targetCurrency: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetRateQuery(baseCurrency, targetCurrency));
  }

  /**
   * Convert an amount between currencies
   * GET /exchange-rates/convert?amount=100&from=USD&to=EUR
   */
  @Get('convert')
  async convert(
    @Query('amount') amount: string,
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
  ): Promise<unknown> {
    return this.queryBus.execute(
      new ConvertAmountQuery(parseFloat(amount), fromCurrency, toCurrency),
    );
  }

  /**
   * Convert an amount between currencies (POST variant for larger payloads)
   * POST /exchange-rates/convert
   */
  @Post('convert')
  async convertPost(@Body() dto: ConvertAmountDto): Promise<unknown> {
    return this.queryBus.execute(
      new ConvertAmountQuery(dto.amount, dto.fromCurrency, dto.toCurrency),
    );
  }
}
