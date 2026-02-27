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
import { CreatePersonDto, UpdatePersonDto } from '../dto';
import {
  CreatePersonCommand,
  UpdatePersonCommand,
  DeletePersonCommand,
} from '../../application/commands';
import { GetPeopleQuery } from '../../application/queries';
import { getRandomEntityColor } from '../../../../shared/constants/entity-colors';

interface PersonResponse {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

@Controller('people')
export class PeopleController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<PersonResponse[]> {
    return this.queryBus.execute(new GetPeopleQuery(userId));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePersonDto,
  ): Promise<PersonResponse> {
    const color = dto.color || getRandomEntityColor();
    return this.commandBus.execute(new CreatePersonCommand(userId, dto.name, color));
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePersonDto,
  ): Promise<PersonResponse> {
    return this.commandBus.execute(new UpdatePersonCommand(id, userId, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.commandBus.execute(new DeletePersonCommand(id, userId));
  }
}
