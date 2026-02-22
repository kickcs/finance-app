import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  GetByAccountIdsDto,
  UpsertBalanceDto,
  CreateManyBalancesDto,
  UpdateByDeltaDto,
} from '../dto/account-balance.dto';
import {
  UpsertBalanceCommand,
  CreateManyBalancesCommand,
  UpdateBalanceByDeltaCommand,
  DeleteBalanceCommand,
  DeleteBalancesByAccountCommand,
} from '../../application/commands';
import { GetBalancesByAccountQuery, GetBalancesByAccountsQuery } from '../../application/queries';

@Controller('account-balances')
export class AccountBalancesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('by-account/:accountId')
  async findByAccount(@Param('accountId') accountId: string): Promise<unknown> {
    return this.queryBus.execute(new GetBalancesByAccountQuery(accountId));
  }

  @Post('by-accounts')
  async findByAccounts(@Body() dto: GetByAccountIdsDto): Promise<unknown> {
    return this.queryBus.execute(new GetBalancesByAccountsQuery(dto.accountIds));
  }

  @Post('upsert')
  async upsert(@Body() dto: UpsertBalanceDto): Promise<unknown> {
    return this.commandBus.execute(
      new UpsertBalanceCommand(dto.accountId, dto.currency, dto.balance),
    );
  }

  @Post('create-many')
  async createMany(@Body() dto: CreateManyBalancesDto): Promise<unknown> {
    return this.commandBus.execute(new CreateManyBalancesCommand(dto.accountId, dto.balances));
  }

  @Post('update-by-delta')
  async updateByDelta(@Body() dto: UpdateByDeltaDto): Promise<unknown> {
    return this.commandBus.execute(
      new UpdateBalanceByDeltaCommand(dto.accountId, dto.currency, dto.delta),
    );
  }

  @Delete(':accountId/:currency')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('accountId') accountId: string,
    @Param('currency') currency: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteBalanceCommand(accountId, currency));
  }

  @Delete('by-account/:accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeByAccount(@Param('accountId') accountId: string): Promise<void> {
    await this.commandBus.execute(new DeleteBalancesByAccountCommand(accountId));
  }
}
