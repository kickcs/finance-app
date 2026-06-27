import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { UpdateProfileCommand } from './update-profile.command';
import { Profile } from '../../../domain';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { ProfileResponse } from '../../types';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<ProfileResponse> {
    const profile = await this.profileRepository.findById(command.userId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    profile.updateProfile(command.data);

    await this.profileRepository.save(profile);
    await this.eventPublisher.publishEvents(profile);

    return this.toResponse(profile);
  }

  private toResponse(profile: Profile): ProfileResponse {
    return {
      id: profile.id,
      email: profile.emailValue,
      name: profile.name,
      currency: profile.currency,
      language: profile.language,
      hasCompletedOnboarding: profile.hasCompletedOnboarding,
      defaultAccountId: profile.defaultAccountId,
      isDemo: profile.isDemo,
      demoExpiresAt: profile.demoExpiresAt,
      dashboardSettings: profile.dashboardSettings,
      quickActionsHidden: profile.quickActionsHidden,
      quickActionsHintDismissed: profile.quickActionsHintDismissed,
      financialMonthStartDay: profile.financialMonthStartDay,
      timezone: profile.timezone,
      notificationHour: profile.notificationHour,
      createdAt: profile.createdAt,
    };
  }
}
