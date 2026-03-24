import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../identity/domain/repositories/profile.repository.interface';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  PaginationDto,
  DateRangeDto,
  AccountPaginationDto,
  AnalyticsQueryDto,
  DailyStatsQueryDto,
  AdjustBalanceDto,
  MonthlyStatsQueryDto,
} from '../dto';
import {
  CreateTransactionCommand,
  UpdateTransactionCommand,
  DeleteTransactionCommand,
  AdjustBalanceCommand,
} from '../../application/commands';
import {
  GetTransactionsPaginatedQuery,
  GetMonthlyStatsQuery,
  GetAnalyticsStatsQuery,
  GetTransactionByIdQuery,
  GetTransactionsByDateRangeQuery,
  GetTransactionsByAccountQuery,
  GetTransactionsByAccountWithIncomingQuery,
  GetTransactionsByAccountPaginatedQuery,
  CountTransactionsByAccountQuery,
  GetHashtagsQuery,
  GetDailyStatsQuery,
} from '../../application/queries';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  @Get()
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<unknown> {
    return this.queryBus.execute(
      new GetTransactionsPaginatedQuery(
        userId,
        pagination.pageSize,
        pagination.cursorDate,
        pagination.cursorCreatedAt,
        pagination.type,
        pagination.accountId,
        pagination.categoryId,
        pagination.search,
        pagination.debtId,
      ),
    );
  }

  @Get('hashtags')
  async getHashtags(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetHashtagsQuery(userId));
  }

  @Get('stats/monthly')
  async getMonthlyStats(
    @CurrentUser('sub') userId: string,
    @Query() query: MonthlyStatsQueryDto,
  ): Promise<unknown> {
    const profile = await this.profileRepository.findById(userId);
    const startDay = profile?.financialMonthStartDay ?? 1;
    return this.queryBus.execute(
      new GetMonthlyStatsQuery(userId, query.year, query.month, startDay),
    );
  }

  @Get('stats/daily')
  async getDailyStats(
    @CurrentUser('sub') userId: string,
    @Query() query: DailyStatsQueryDto,
  ): Promise<unknown> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    return this.queryBus.execute(
      new GetDailyStatsQuery(userId, startDate, endDate, query.accountIds, query.groupBy),
    );
  }

  @Get('stats/analytics')
  async getAnalyticsStats(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<unknown> {
    // Parse dates - endDate should be end of day to include all transactions on that day
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    return this.queryBus.execute(
      new GetAnalyticsStatsQuery(userId, startDate, endDate, query.accountIds),
    );
  }

  @Get('by-date-range')
  async findByDateRange(
    @CurrentUser('sub') userId: string,
    @Query() query: DateRangeDto,
  ): Promise<unknown> {
    return this.queryBus.execute(
      new GetTransactionsByDateRangeQuery(
        userId,
        new Date(query.startDate),
        new Date(query.endDate),
      ),
    );
  }

  @Get('by-account/:accountId')
  async findByAccount(
    @CurrentUser('sub') userId: string,
    @Param('accountId') accountId: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetTransactionsByAccountQuery(accountId, userId));
  }

  @Get('by-account/:accountId/with-incoming')
  async findByAccountWithIncoming(
    @CurrentUser('sub') userId: string,
    @Param('accountId') accountId: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetTransactionsByAccountWithIncomingQuery(accountId, userId));
  }

  @Get('by-account/:accountId/count')
  async countByAccount(
    @CurrentUser('sub') userId: string,
    @Param('accountId') accountId: string,
  ): Promise<{ count: number }> {
    return this.queryBus.execute(new CountTransactionsByAccountQuery(accountId, userId));
  }

  @Get('by-account/:accountId/paginated')
  async findByAccountPaginated(
    @CurrentUser('sub') userId: string,
    @Param('accountId') accountId: string,
    @Query() pagination: AccountPaginationDto,
  ): Promise<unknown> {
    return this.queryBus.execute(
      new GetTransactionsByAccountPaginatedQuery(
        accountId,
        userId,
        pagination.pageSize ?? 20,
        pagination.cursorDate,
        pagination.cursorCreatedAt,
      ),
    );
  }

  @Get(':id')
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<unknown> {
    return this.queryBus.execute(new GetTransactionByIdQuery(id, userId));
  }

  @Post('adjust-balance')
  async adjustBalance(
    @CurrentUser('sub') userId: string,
    @Body() dto: AdjustBalanceDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new AdjustBalanceCommand(
        userId,
        dto.accountId,
        dto.targetBalance,
        dto.currency,
        dto.date ? new Date(dto.date) : new Date(),
        dto.description,
      ),
    );
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateTransactionCommand(
        userId,
        dto.accountId,
        dto.categoryId,
        dto.amount,
        dto.currency,
        dto.type,
        new Date(dto.date),
        dto.description,
        dto.isDebtRelated,
        dto.toAccountId,
        dto.toAmount,
        dto.toCurrency,
        dto.debtId,
        dto.feeAmount,
      ),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new UpdateTransactionCommand(id, userId, {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteTransactionCommand(id, userId));
  }
}
