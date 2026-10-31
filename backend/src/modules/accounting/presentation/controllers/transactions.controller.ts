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
  BadRequestException,
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
  TransactionFilterDto,
  DateRangeDto,
  AccountPaginationDto,
  AnalyticsQueryDto,
  DailyStatsQueryDto,
  AdjustBalanceDto,
  MonthlyStatsQueryDto,
  BulkUpdateTransactionsDto,
  BulkSelectionDto,
  BulkActionDto,
  UndoBulkUpdateDto,
} from '../dto';
import {
  CreateTransactionCommand,
  UpdateTransactionCommand,
  DeleteTransactionCommand,
  AdjustBalanceCommand,
  BulkUpdateTransactionsCommand,
  UndoBulkUpdateCommand,
  type BulkAction,
  type BulkSelectionInput,
} from '../../application/commands';
import {
  GetTransactionsPaginatedQuery,
  GetTransactionsSummaryQuery,
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
import { startOfDayInTz, endOfDayInTz } from '../../../../shared/utils/date';
import type { TransactionFilter } from '../../domain/repositories/transaction.repository.interface';

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
    const { pageSize, cursorDate, cursorCreatedAt, cursorId, ...filter } = pagination;
    return this.queryBus.execute(
      new GetTransactionsPaginatedQuery(userId, await this.toFilter(userId, filter), {
        pageSize,
        cursorDate,
        cursorCreatedAt,
        cursorId,
      }),
    );
  }

  // Объявлен до `:id`, иначе «summary» разберётся как идентификатор транзакции.
  @Get('summary')
  async getSummary(
    @CurrentUser('sub') userId: string,
    @Query() query: TransactionFilterDto,
  ): Promise<unknown> {
    return this.queryBus.execute(
      new GetTransactionsSummaryQuery(userId, await this.toFilter(userId, query)),
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
    const { timezone, financialMonthStartDay } = await this.calendarOf(userId);
    return this.queryBus.execute(
      new GetMonthlyStatsQuery(userId, query.year, query.month, financialMonthStartDay, timezone),
    );
  }

  @Get('stats/daily')
  async getDailyStats(
    @CurrentUser('sub') userId: string,
    @Query() query: DailyStatsQueryDto,
  ): Promise<unknown> {
    const { timezone: tz } = await this.calendarOf(userId);

    // Interpret the YYYY-MM-DD range in the user's timezone, not the server's UTC,
    // so day boundaries line up with the user's local calendar day.
    const startDate = startOfDayInTz(query.startDate, tz);
    const endDate = endOfDayInTz(query.endDate, tz);

    return this.queryBus.execute(
      new GetDailyStatsQuery(userId, startDate, endDate, query.accountIds, query.groupBy),
    );
  }

  @Get('stats/analytics')
  async getAnalyticsStats(
    @CurrentUser('sub') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<unknown> {
    const { timezone: tz } = await this.calendarOf(userId);

    // Boundaries in the user's timezone: startOfDay/endOfDay map the local calendar
    // day to the correct UTC instants (e.g. 00:00 UTC+5 → 19:00 UTC the day before).
    const startDate = startOfDayInTz(query.startDate, tz);
    const endDate = endOfDayInTz(query.endDate, tz);

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
        pagination.pageSize,
        pagination.cursorDate,
        pagination.cursorCreatedAt,
        pagination.cursorId,
      ),
    );
  }

  // Объявлены до `:id`, иначе «bulk» разберётся как идентификатор транзакции.
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkUpdate(
    @CurrentUser('sub') userId: string,
    @Body() dto: BulkUpdateTransactionsDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new BulkUpdateTransactionsCommand(
        userId,
        await this.toBulkSelection(userId, dto.selection),
        toBulkAction(dto.action),
        dto.dryRun ?? false,
      ),
    );
  }

  @Post('bulk/undo')
  @HttpCode(HttpStatus.OK)
  async undoBulkUpdate(
    @CurrentUser('sub') userId: string,
    @Body() dto: UndoBulkUpdateDto,
  ): Promise<unknown> {
    return this.commandBus.execute(new UndoBulkUpdateCommand(userId, dto.undoToken));
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
        undefined,
        dto.isInformational ?? false,
        dto.secondPart,
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

  /** Либо `ids`, либо фильтр со сверкой; обе сразу или ни одной — ошибка запроса. */
  private async toBulkSelection(
    userId: string,
    dto: BulkSelectionDto,
  ): Promise<BulkSelectionInput> {
    if (dto.ids !== undefined && dto.filter !== undefined) {
      throw new BadRequestException('Укажите либо ids, либо filter, а не оба сразу');
    }
    if (dto.ids !== undefined) {
      return { kind: 'ids', ids: dto.ids };
    }
    return {
      kind: 'filter',
      filter: await this.toFilter(userId, dto.filter!),
      asOf: new Date(dto.asOf!),
      expectedCount: dto.expectedCount!,
    };
  }

  /** Календарные даты фильтра → моменты в часовом поясе пользователя (как у `stats/analytics`). */
  private async toFilter(userId: string, dto: TransactionFilterDto): Promise<TransactionFilter> {
    const { startDate, endDate, ...rest } = dto;
    if (!startDate && !endDate) return rest;

    const { timezone: tz } = await this.calendarOf(userId);
    return {
      ...rest,
      startDate: startDate ? startOfDayInTz(startDate, tz) : undefined,
      endDate: endDate ? endOfDayInTz(endDate, tz) : undefined,
    };
  }

  /** Часовой пояс и первый день финансового месяца из профиля; без профиля — UTC и 1-е число. */
  private async calendarOf(
    userId: string,
  ): Promise<{ timezone: string; financialMonthStartDay: number }> {
    const profile = await this.profileRepository.findById(userId);
    return {
      timezone: profile?.timezone ?? 'UTC',
      financialMonthStartDay: profile?.financialMonthStartDay ?? 1,
    };
  }
}

/**
 * В действие попадают только поля его вида: лишние из тела не доезжают до обработчика.
 * `kind` типизирован по `BULK_ACTION_KINDS`: вид без ветки здесь не соберётся.
 */
function toBulkAction(dto: BulkActionDto): BulkAction {
  switch (dto.kind) {
    case 'category':
      return { kind: 'category', categoryId: dto.categoryId! };
    case 'transfer':
      return { kind: 'transfer', toAccountId: dto.toAccountId! };
    case 'account':
      return { kind: 'account', accountId: dto.accountId! };
    case 'tag':
      return { kind: 'tag', tag: dto.tag! };
    case 'delete':
      return { kind: 'delete' };
  }
}
