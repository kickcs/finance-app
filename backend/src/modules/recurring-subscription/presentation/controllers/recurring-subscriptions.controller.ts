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
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser, JwtAuthGuard } from '../../../../common';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CalendarQueryDto,
  UpcomingQueryDto,
} from '../dto';
import {
  CreateSubscriptionCommand,
  UpdateSubscriptionCommand,
  DeleteSubscriptionCommand,
  PauseSubscriptionCommand,
  ResumeSubscriptionCommand,
} from '../../application/commands';
import {
  GetSubscriptionsQuery,
  GetSubscriptionByIdQuery,
  GetUpcomingSubscriptionsQuery,
  GetCalendarSubscriptionsQuery,
} from '../../application/queries';
import { SubscriptionFrequency } from '../../domain/aggregates/recurring-subscription';

@Controller('recurring-subscriptions')
@UseGuards(JwtAuthGuard)
export class RecurringSubscriptionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetSubscriptionsQuery(userId));
  }

  @Get('calendar')
  async getCalendar(
    @CurrentUser('sub') userId: string,
    @Query() dto: CalendarQueryDto,
  ): Promise<unknown> {
    const [yearStr, monthStr] = dto.month.split('-');
    return this.queryBus.execute(
      new GetCalendarSubscriptionsQuery(userId, parseInt(yearStr, 10), parseInt(monthStr, 10)),
    );
  }

  @Get('upcoming')
  async getUpcoming(
    @CurrentUser('sub') userId: string,
    @Query() dto: UpcomingQueryDto,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetUpcomingSubscriptionsQuery(userId, dto.days ?? 7));
  }

  @Get(':id')
  async findOne(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<unknown> {
    return this.queryBus.execute(new GetSubscriptionByIdQuery(id, userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateSubscriptionCommand(
        userId,
        dto.name,
        dto.amount,
        dto.currency,
        dto.icon,
        dto.color,
        dto.frequency as SubscriptionFrequency,
        new Date(dto.billingDate),
        dto.categoryId ?? 'entertainment',
        dto.description,
        dto.accountId,
        dto.frequencyDays,
        dto.notifyDaysBefore ?? [2],
        dto.autoCharge ?? false,
      ),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new UpdateSubscriptionCommand(id, userId, {
        ...dto,
        frequency: dto.frequency ? (dto.frequency as SubscriptionFrequency) : undefined,
        billingDate: dto.billingDate ? new Date(dto.billingDate) : undefined,
      }),
    );
  }

  @Patch(':id/pause')
  async pause(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<unknown> {
    return this.commandBus.execute(new PauseSubscriptionCommand(id, userId));
  }

  @Patch(':id/resume')
  async resume(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<unknown> {
    return this.commandBus.execute(new ResumeSubscriptionCommand(id, userId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteSubscriptionCommand(id, userId));
  }
}
