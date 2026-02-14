import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { CreateAccountDto, UpdateAccountDto, ReorderAccountsDto } from '../dto';
import {
  CreateAccountCommand,
  UpdateAccountCommand,
  DeleteAccountCommand,
  ReorderAccountsCommand,
} from '../../application/commands';
import {
  GetAccountsQuery,
  GetAccountByIdQuery,
} from '../../application/queries';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetAccountsQuery(userId));
  }

  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetAccountByIdQuery(id, userId));
  }

  @Get(':id/with-balances')
  async findOneWithBalances(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetAccountByIdQuery(id, userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateAccountCommand(
        userId,
        dto.name,
        dto.icon,
        dto.color,
        dto.type,
        dto.order,
        dto.balances,
        {
          creditLimit: dto.creditLimit,
          gracePeriodDays: dto.gracePeriodDays,
          billingDay: dto.billingDay,
          totalAmount: dto.totalAmount,
          interestRate: dto.interestRate,
          monthlyPayment: dto.monthlyPayment,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
          isReplenishable: dto.isReplenishable,
          isWithdrawable: dto.isWithdrawable,
        },
      ),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<unknown> {
    const { startDate, endDate, maturityDate, ...rest } = dto;
    return this.commandBus.execute(
      new UpdateAccountCommand(id, userId, {
        ...rest,
        startDate:
          startDate !== undefined
            ? startDate
              ? new Date(startDate)
              : null
            : undefined,
        endDate:
          endDate !== undefined
            ? endDate
              ? new Date(endDate)
              : null
            : undefined,
        maturityDate:
          maturityDate !== undefined
            ? maturityDate
              ? new Date(maturityDate)
              : null
            : undefined,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteAccountCommand(id, userId));
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser('sub') userId: string,
    @Body() dto: ReorderAccountsDto,
  ) {
    await this.commandBus.execute(
      new ReorderAccountsCommand(dto.accountIds, userId),
    );
    return { success: true };
  }
}
