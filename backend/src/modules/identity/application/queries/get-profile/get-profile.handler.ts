import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { GetProfileQuery } from './get-profile.query';
import { Profile } from '../../../domain';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../../domain/repositories/profile.repository.interface';
import { ProfileResponse } from '../../types';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(query: GetProfileQuery): Promise<ProfileResponse> {
    const profile = await this.profileRepository.findById(query.userId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

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
