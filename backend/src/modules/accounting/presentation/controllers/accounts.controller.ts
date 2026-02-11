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
import { CreateAccountDto, UpdateAccountDto } from '../dto';
import {
  CreateAccountCommand,
  UpdateAccountCommand,
  DeleteAccountCommand,
  ReorderAccountsCommand,
} from '../../application/commands';
import {
  GetAccountsQuery,
  GetAccountByIdQuery,
} from '../../application/queries';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string): Promise<unknown> {
    return this.queryBus.execute(new GetAccountsQuery(userId));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.queryBus.execute(new GetAccountByIdQuery(id));
  }

  @Get(':id/with-balances')
  async findOneWithBalances(@Param('id') id: string): Promise<unknown> {
    return this.queryBus.execute(new GetAccountByIdQuery(id));
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<unknown> {
    return this.commandBus.execute(
      new CreateAccountCommand(
        userId,
        dto.name,
        dto.icon,
        dto.color,
        dto.type,
        dto.order,
        dto.balances,
      ),
    );
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<unknown> {
    return this.commandBus.execute(new UpdateAccountCommand(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.commandBus.execute(new DeleteAccountCommand(id));
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() body: { accountIds: string[] }) {
    await this.commandBus.execute(new ReorderAccountsCommand(body.accountIds));
    return { success: true };
  }
}
