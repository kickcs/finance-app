import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RegisterPushDeviceCommand } from './register-push-device.command';
import { PushDevice } from '../../../domain/aggregates/push-device';
import { IPushDeviceRepository, PUSH_DEVICE_REPOSITORY } from '../../../domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(RegisterPushDeviceCommand)
export class RegisterPushDeviceHandler implements ICommandHandler<RegisterPushDeviceCommand> {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepository: IPushDeviceRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RegisterPushDeviceCommand): Promise<void> {
    const device = PushDevice.register(
      crypto.randomUUID(),
      command.userId,
      command.token,
      command.platform,
      command.deviceId,
    );

    await this.pushDeviceRepository.upsertByUserAndToken(device);
    await this.eventPublisher.publishEvents(device);
  }
}
