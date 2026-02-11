import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LogoutCommand } from './logout.command';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const profile = await this.profileRepository.findById(command.userId);

    if (profile) {
      profile.setRefreshToken(null);
      await this.profileRepository.save(profile);
    }
  }
}
