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
import { CreateDebtDto, UpdateDebtDto } from '../dto';
import {
  CreateDebtCommand,
  UpdateDebtCommand,
  DeleteDebtCommand,
} from '../../application/commands';
import { GetDebtsQuery, GetDebtByIdQuery } from '../../application/queries';

@Controller('debts')
export class DebtsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetDebtsQuery(userId));
  }

  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetDebtByIdQuery(id, userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDebtDto,
  ): Promise<unknown> {
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
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteDebtCommand(id, userId));
  }
}
