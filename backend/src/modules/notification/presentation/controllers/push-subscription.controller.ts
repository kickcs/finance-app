import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Body,
  Param,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { RegisterPushSubscriptionDto, UpdateNotificationPreferencesDto } from '../dto';
import {
  RegisterPushSubscriptionCommand,
  UnregisterPushSubscriptionCommand,
  UpdateNotificationPreferencesCommand,
} from '../../application/commands';
import { GetNotificationPreferencesQuery } from '../../application/queries';
import {
  PUSH_NOTIFICATION_SERVICE,
  IPushNotificationService,
} from '../../application/services/push-notification.service';
import { NotificationPreferencesResponse } from '../../application/types';

@Controller('push-subscriptions')
export class PushSubscriptionController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(PUSH_NOTIFICATION_SERVICE)
    private readonly pushNotificationService: IPushNotificationService,
  ) {}

  @Post()
  async register(
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterPushSubscriptionDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RegisterPushSubscriptionCommand(
        userId,
        dto.endpoint,
        dto.p256dh,
        dto.auth,
        dto.userAgent,
      ),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new UnregisterPushSubscriptionCommand(id, userId));
  }

  @Post('test')
  async sendTest(@CurrentUser('sub') userId: string): Promise<void> {
    await this.pushNotificationService.sendToUser(userId, {
      title: 'Тестовое уведомление',
      body: 'Push-уведомления работают!',
      tag: 'test',
    });
  }

  @Get('preferences')
  async getPreferences(
    @CurrentUser('sub') userId: string,
  ): Promise<NotificationPreferencesResponse> {
    return this.queryBus.execute<GetNotificationPreferencesQuery, NotificationPreferencesResponse>(
      new GetNotificationPreferencesQuery(userId),
    );
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    return this.commandBus.execute<
      UpdateNotificationPreferencesCommand,
      NotificationPreferencesResponse
    >(new UpdateNotificationPreferencesCommand(userId, dto));
  }
}
