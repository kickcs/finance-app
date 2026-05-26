import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CurrentUser } from '../../../../common';
import { RegisterPushDeviceDto, UnregisterPushDeviceDto } from '../dto';
import { RegisterPushDeviceCommand, UnregisterPushDeviceCommand } from '../../application/commands';

@Controller('push-devices')
export class PushDeviceController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async register(
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterPushDeviceDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new RegisterPushDeviceCommand(userId, dto.token, dto.platform, dto.deviceId),
    );
  }

  // Intentionally POST (not DELETE): per RFC 7231, DELETE request bodies have
  // no defined semantics and many HTTP/2 intermediaries, CDNs, and the React
  // Native fetch polyfill strip the body. A DELETE-with-body unregister would
  // silently fail on those clients and leave stale tokens receiving pushes
  // after logout.
  @Post('unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @CurrentUser('sub') userId: string,
    @Body() dto: UnregisterPushDeviceDto,
  ): Promise<void> {
    await this.commandBus.execute(new UnregisterPushDeviceCommand(userId, dto.token));
  }
}
