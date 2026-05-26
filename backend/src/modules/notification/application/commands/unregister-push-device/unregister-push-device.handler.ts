import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UnregisterPushDeviceCommand } from './unregister-push-device.command';
import { IPushDeviceRepository, PUSH_DEVICE_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(UnregisterPushDeviceCommand)
export class UnregisterPushDeviceHandler implements ICommandHandler<UnregisterPushDeviceCommand> {
  constructor(
    @Inject(PUSH_DEVICE_REPOSITORY)
    private readonly pushDeviceRepository: IPushDeviceRepository,
  ) {}

  async execute(command: UnregisterPushDeviceCommand): Promise<void> {
    await this.pushDeviceRepository.removeByToken(command.userId, command.token);
  }
}
