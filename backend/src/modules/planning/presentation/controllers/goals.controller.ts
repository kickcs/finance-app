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
import { CreateGoalDto, UpdateGoalDto } from '../dto';
import {
  CreateGoalCommand,
  UpdateGoalCommand,
  DeleteGoalCommand,
} from '../../application/commands';
import { GetGoalsQuery, GetGoalByIdQuery } from '../../application/queries';

@Controller('goals')
export class GoalsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetGoalsQuery(userId));
  }

  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new GetGoalByIdQuery(id, userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateGoalDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateGoalCommand(
        userId,
        dto.name,
        dto.targetAmount,
        dto.icon,
        dto.color,
        dto.deadline ? new Date(dto.deadline) : undefined,
        dto.currentAmount,
      ),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new UpdateGoalCommand(id, userId, {
        ...dto,
        deadline:
          dto.deadline !== undefined
            ? dto.deadline
              ? new Date(dto.deadline)
              : null
            : undefined,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.commandBus.execute(new DeleteGoalCommand(id, userId));
  }
}
