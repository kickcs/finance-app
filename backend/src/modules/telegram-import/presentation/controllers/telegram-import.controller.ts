import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CreateLinkTokenCommand } from '../../application/commands/create-link-token/create-link-token.command';
import { UnlinkTelegramCommand } from '../../application/commands/unlink-telegram/unlink-telegram.command';
import { ConfirmImportedCommand } from '../../application/commands/confirm-imported/confirm-imported.command';
import { DismissImportedCommand } from '../../application/commands/dismiss-imported/dismiss-imported.command';
import { SetCardMappingCommand } from '../../application/commands/set-card-mapping/set-card-mapping.command';
import { DeleteCardMappingCommand } from '../../application/commands/delete-card-mapping/delete-card-mapping.command';
import { GetLinkStatusQuery } from '../../application/queries/get-link-status/get-link-status.query';
import { GetInboxQuery } from '../../application/queries/get-inbox/get-inbox.query';
import { type GetInboxHandler } from '../../application/queries/get-inbox/get-inbox.handler';
import { GetCardsQuery } from '../../application/queries/get-cards/get-cards.query';
import { type GetCardsHandler } from '../../application/queries/get-cards/get-cards.handler';
import { ConfirmImportedDto } from '../dto/confirm-imported.dto';
import { SetCardMappingDto } from '../dto/set-card-mapping.dto';

type InboxResponse = Awaited<ReturnType<GetInboxHandler['execute']>>;
type CardsResponse = Awaited<ReturnType<GetCardsHandler['execute']>>;

@Controller('telegram-import')
export class TelegramImportController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('link-token')
  async createLinkToken(@CurrentUser('sub') userId: string): Promise<{ deepLink: string }> {
    return this.commandBus.execute<CreateLinkTokenCommand, { deepLink: string }>(
      new CreateLinkTokenCommand(userId),
    );
  }

  @Get('link')
  async getLinkStatus(
    @CurrentUser('sub') userId: string,
  ): Promise<{ linked: boolean; telegramUsername: string | null }> {
    return this.queryBus.execute<
      GetLinkStatusQuery,
      { linked: boolean; telegramUsername: string | null }
    >(new GetLinkStatusQuery(userId));
  }

  @Delete('link')
  async unlink(@CurrentUser('sub') userId: string): Promise<{ success: boolean }> {
    return this.commandBus.execute<UnlinkTelegramCommand, { success: boolean }>(
      new UnlinkTelegramCommand(userId),
    );
  }

  @Get('inbox')
  async getInbox(@CurrentUser('sub') userId: string): Promise<InboxResponse> {
    return this.queryBus.execute<GetInboxQuery, InboxResponse>(new GetInboxQuery(userId));
  }

  @Post('inbox/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmImportedDto,
  ): Promise<{ success: boolean; counterpartId: string | null }> {
    return this.commandBus.execute<
      ConfirmImportedCommand,
      { success: boolean; counterpartId: string | null }
    >(new ConfirmImportedCommand(userId, id, dto.transactionId, dto.accountId, dto.toAccountId));
  }

  @Post('inbox/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismiss(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.commandBus.execute<DismissImportedCommand, { success: boolean }>(
      new DismissImportedCommand(userId, id),
    );
  }

  @Get('cards')
  async getCards(@CurrentUser('sub') userId: string): Promise<CardsResponse> {
    return this.queryBus.execute<GetCardsQuery, CardsResponse>(new GetCardsQuery(userId));
  }

  @Put('cards/:cardMask')
  async setCardMapping(
    @CurrentUser('sub') userId: string,
    @Param('cardMask') cardMask: string,
    @Body() dto: SetCardMappingDto,
  ): Promise<{ success: boolean }> {
    return this.commandBus.execute<SetCardMappingCommand, { success: boolean }>(
      new SetCardMappingCommand(userId, decodeURIComponent(cardMask), dto.accountId),
    );
  }

  @Delete('cards/:cardMask')
  async deleteCardMapping(
    @CurrentUser('sub') userId: string,
    @Param('cardMask') cardMask: string,
  ): Promise<{ success: boolean }> {
    return this.commandBus.execute<DeleteCardMappingCommand, { success: boolean }>(
      new DeleteCardMappingCommand(userId, decodeURIComponent(cardMask)),
    );
  }
}
