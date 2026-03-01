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
import { CreateQuickActionDto } from '../dto/create-quick-action.dto';
import { UpdateQuickActionDto } from '../dto/update-quick-action.dto';
import { CreateQuickActionCommand } from '../../application/commands/create-quick-action/create-quick-action.command';
import { UpdateQuickActionCommand } from '../../application/commands/update-quick-action/update-quick-action.command';
import { DeleteQuickActionCommand } from '../../application/commands/delete-quick-action/delete-quick-action.command';
import { ReorderQuickActionsCommand } from '../../application/commands/reorder-quick-actions/reorder-quick-actions.command';
import { GetQuickActionsQuery } from '../../application/queries/get-quick-actions/get-quick-actions.query';

@Controller('quick-actions')
export class QuickActionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetQuickActionsQuery(userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateQuickActionDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateQuickActionCommand(userId, dto.categoryId, dto.accountId, dto.label),
    );
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser('sub') userId: string,
    @Body() body: { ids: string[] },
  ): Promise<unknown> {
    return this.commandBus.execute(new ReorderQuickActionsCommand(userId, body.ids));
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuickActionDto,
  ): Promise<unknown> {
    return this.commandBus.execute(new UpdateQuickActionCommand(id, userId, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeleteQuickActionCommand(id, userId));
  }
}
