import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  ParseIntPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { SetDefaultBudgetDto, SetMonthlyOverrideDto } from '../dto';
import {
  SetDefaultBudgetCommand,
  SetMonthlyBudgetOverrideCommand,
  RemoveMonthlyBudgetOverrideCommand,
} from '../../application/commands';
import { GetBudgetForMonthQuery, GetBudgetHistoryQuery } from '../../application/queries';
import { getCurrentFinancialMonth } from '../../../../shared/utils/financial-period';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../identity/domain/repositories/profile.repository.interface';

@Controller('budgets')
export class BudgetsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  private async getProfileFields(userId: string) {
    const profile = await this.profileRepository.findById(userId);
    return {
      currency: profile?.currency ?? 'USD',
      startDay: profile?.financialMonthStartDay ?? 1,
    };
  }

  @Get('current')
  async getCurrent(@CurrentUser('sub') userId: string): Promise<unknown> {
    const { startDay } = await this.getProfileFields(userId);
    const { year, month } = getCurrentFinancialMonth(startDay);
    return this.queryBus.execute(new GetBudgetForMonthQuery(userId, year, month, startDay));
  }

  @Get('history')
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('months') months?: string,
  ): Promise<unknown> {
    const parsedMonths = months ? parseInt(months, 10) : 6;
    const { startDay } = await this.getProfileFields(userId);
    return this.queryBus.execute(
      new GetBudgetHistoryQuery(userId, isNaN(parsedMonths) ? 6 : parsedMonths, startDay),
    );
  }

  @Put('default')
  async setDefault(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetDefaultBudgetDto,
  ): Promise<unknown> {
    const { currency } = await this.getProfileFields(userId);
    return this.commandBus.execute(new SetDefaultBudgetCommand(userId, dto.amount, currency));
  }

  @Put('override')
  async setOverride(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetMonthlyOverrideDto,
  ): Promise<unknown> {
    const { currency } = await this.getProfileFields(userId);
    return this.commandBus.execute(
      new SetMonthlyBudgetOverrideCommand(userId, dto.year, dto.month, dto.amount, currency),
    );
  }

  @Delete('override/:year/:month')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOverride(
    @CurrentUser('sub') userId: string,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    await this.commandBus.execute(new RemoveMonthlyBudgetOverrideCommand(userId, year, month));
  }
}
