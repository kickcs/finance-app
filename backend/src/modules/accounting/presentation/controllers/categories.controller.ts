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
import { CreateCategoryDto, UpdateCategoryDto } from '../dto';
import {
  CreateCategoryCommand,
  UpdateCategoryCommand,
  DeleteCategoryCommand,
  ReorderCategoriesCommand,
  InitializeDefaultCategoriesCommand,
} from '../../application/commands';
import { GetCategoriesQuery } from '../../application/queries';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('type') type?: 'income' | 'expense',
  ): Promise<unknown> {
    return this.queryBus.execute(new GetCategoriesQuery(userId, type));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateCategoryCommand(
        userId,
        dto.name,
        dto.icon,
        dto.color,
        dto.type,
        dto.sortOrder,
      ),
    );
  }

  @Post('initialize-defaults')
  async initializeDefaults(
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new InitializeDefaultCategoriesCommand(userId),
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<unknown> {
    return this.commandBus.execute(new UpdateCategoryCommand(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.commandBus.execute(new DeleteCategoryCommand(id));
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() body: { categoryIds: string[] }) {
    await this.commandBus.execute(
      new ReorderCategoriesCommand(body.categoryIds),
    );
    return { success: true };
  }
}
