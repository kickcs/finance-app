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
import { CreateReminderDto, UpdateReminderDto } from '../dto';
import {
  CreateReminderCommand,
  UpdateReminderCommand,
  DeleteReminderCommand,
} from '../../application/commands';
import {
  GetRemindersQuery,
  GetReminderByIdQuery,
} from '../../application/queries';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetRemindersQuery(userId));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.queryBus.execute(new GetReminderByIdQuery(id));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReminderDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateReminderCommand(
        userId,
        dto.name,
        dto.amount,
        dto.frequency,
        new Date(dto.nextDate),
        dto.icon,
        dto.color,
      ),
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new UpdateReminderCommand(id, {
        ...dto,
        nextDate: dto.nextDate ? new Date(dto.nextDate) : undefined,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.commandBus.execute(new DeleteReminderCommand(id));
  }
}
