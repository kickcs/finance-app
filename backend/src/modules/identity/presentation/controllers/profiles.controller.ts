import { Controller, Get, Post, Patch, Body } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UpdateProfileDto } from '../dto';
import { CurrentUser } from '../../../../common';
import { GetProfileQuery } from '../../application/queries';
import { UpdateProfileCommand } from '../../application/commands';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('me')
  async getProfile(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetProfileQuery(userId));
  }

  @Post('get-or-create')
  async getOrCreateProfile(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetProfileQuery(userId));
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<unknown> {
    return this.commandBus.execute(new UpdateProfileCommand(userId, dto));
  }
}
