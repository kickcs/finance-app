import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { RegisterPushSubscriptionDto } from '../dto';
import {
  RegisterPushSubscriptionCommand,
  UnregisterPushSubscriptionCommand,
} from '../../application/commands';
import {
  PUSH_NOTIFICATION_SERVICE,
  IPushNotificationService,
} from '../../application/services/push-notification.service';

@Controller('push-subscriptions')
export class PushSubscriptionController {
  constructor(
    private readonly commandBus: CommandBus,
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
}
