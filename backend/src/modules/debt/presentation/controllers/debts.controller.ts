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
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import {
  CreateDebtDto,
  UpdateDebtDto,
  GetDebtsPaginatedDto,
  OffsetDebtsDto,
  PayDebtDto,
} from '../dto';
import {
  CreateDebtCommand,
  UpdateDebtCommand,
  DeleteDebtCommand,
  ReopenDebtCommand,
  OffsetDebtsCommand,
  PayDebtCommand,
} from '../../application/commands';
import { GetDebtsQuery, GetDebtByIdQuery, GetDebtsPaginatedQuery } from '../../application/queries';

@Controller('debts')
export class DebtsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: 'active' | 'closed',
  ): Promise<unknown> {
    return this.queryBus.execute(new GetDebtsQuery(userId, status));
  }

  @Get('paginated')
  async getPaginated(
    @CurrentUser('sub') userId: string,
    @Query() dto: GetDebtsPaginatedDto,
  ): Promise<unknown> {
    return this.queryBus.execute(
      new GetDebtsPaginatedQuery(
        userId,
        dto.pageSize,
        dto.cursorPersonName,
        dto.cursorDebtType,
        dto.cursorCreatedAt,
        dto.status,
        dto.currency,
        dto.personName,
      ),
    );
  }

  // Объявлен до `:id`, иначе Nest примет "offset" за идентификатор долга.
  @Post('offset')
  async offset(@CurrentUser('sub') userId: string, @Body() dto: OffsetDebtsDto): Promise<unknown> {
    return this.commandBus.execute(new OffsetDebtsCommand(userId, dto.personName, dto.currency));
  }

  @Get(':id')
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<unknown> {
    return this.queryBus.execute(new GetDebtByIdQuery(id, userId));
  }

  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateDebtDto): Promise<unknown> {
    return this.commandBus.execute(
      new CreateDebtCommand(
        userId,
        dto.name,
        dto.totalAmount,
        dto.remainingAmount,
        dto.debtType,
        dto.currency,
        dto.personName,
        dto.accountId,
        dto.monthlyPayment,
        dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : undefined,
        dto.transactionId,
        dto.sourceTransactionId,
        dto.createdAt ? new Date(dto.createdAt) : undefined,
        dto.description,
        dto.isPrivate,
        dto.feeAmount,
      ),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDebtDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new UpdateDebtCommand(id, userId, {
        ...dto,
        nextPaymentDate:
          dto.nextPaymentDate !== undefined
            ? dto.nextPaymentDate
              ? new Date(dto.nextPaymentDate)
              : null
            : undefined,
        createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
      }),
    );
  }

  @Post(':id/payments')
  async pay(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PayDebtDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new PayDebtCommand(
        userId,
        id,
        dto.amount,
        dto.accountId,
        dto.date ? new Date(dto.date) : new Date(),
        dto.forgiveRemainder ?? false,
        dto.excessCategoryId,
      ),
    );
  }

  @Post(':id/reopen')
  async reopen(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<unknown> {
    return this.commandBus.execute(new ReopenDebtCommand(id, userId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteDebtCommand(id, userId));
  }
}
