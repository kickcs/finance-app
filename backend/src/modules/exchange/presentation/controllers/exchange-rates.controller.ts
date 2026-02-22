import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UpsertRateDto, ConvertAmountDto } from '../dto';
import { UpsertRateCommand } from '../../application/commands';
import { GetRateQuery, ConvertAmountQuery } from '../../application/queries';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

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
   * Create or update an exchange rate
   * POST /exchange-rates
   */
  @Post()
  async upsertRate(@Body() dto: UpsertRateDto): Promise<unknown> {
    return this.commandBus.execute(
      new UpsertRateCommand(dto.baseCurrency, dto.targetCurrency, dto.rate),
    );
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
