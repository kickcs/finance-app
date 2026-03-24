import { Profile, Email, Password } from '../../../domain';
import type { DashboardSettings } from '../../../domain/entities/profile.entity';
import { ProfileOrmEntity } from '../typeorm/profile.orm-entity';

/**
 * Profile Mapper
 * Maps between domain Profile entity and ORM ProfileOrmEntity
 */
export class ProfileMapper {
  /**
   * Map ORM entity to domain entity
   */
  static toDomain(ormEntity: ProfileOrmEntity): Profile {
    return Profile.reconstitute({
      id: ormEntity.id,
      email: ormEntity.email ? Email.create(ormEntity.email) : null,
      name: ormEntity.name,
      password: ormEntity.passwordHash ? Password.fromHash(ormEntity.passwordHash) : null,
      currency: ormEntity.currency,
      hasCompletedOnboarding: ormEntity.hasCompletedOnboarding,
      defaultAccountId: ormEntity.defaultAccountId,
      isDemo: ormEntity.isDemo,
      demoExpiresAt: ormEntity.demoExpiresAt,
      refreshToken: ormEntity.refreshToken,
      dashboardSettings: ormEntity.dashboardSettings as DashboardSettings | null,
      quickActionsHidden: ormEntity.quickActionsHidden,
      quickActionsHintDismissed: ormEntity.quickActionsHintDismissed,
      financialMonthStartDay: ormEntity.financialMonthStartDay,
      createdAt: ormEntity.createdAt,
    });
  }

  /**
   * Map domain entity to ORM entity
   */
  static toOrm(domainEntity: Profile): ProfileOrmEntity {
    const ormEntity = new ProfileOrmEntity();

    ormEntity.id = domainEntity.id;
    ormEntity.email = domainEntity.emailValue;
    ormEntity.name = domainEntity.name;
    ormEntity.passwordHash = domainEntity.password?.hashedValue ?? null;
    ormEntity.currency = domainEntity.currency;
    ormEntity.hasCompletedOnboarding = domainEntity.hasCompletedOnboarding;
    ormEntity.defaultAccountId = domainEntity.defaultAccountId;
    ormEntity.isDemo = domainEntity.isDemo;
    ormEntity.demoExpiresAt = domainEntity.demoExpiresAt;
    ormEntity.refreshToken = domainEntity.refreshToken;
    ormEntity.dashboardSettings = domainEntity.dashboardSettings as Record<string, unknown> | null;
    ormEntity.quickActionsHidden = domainEntity.quickActionsHidden;
    ormEntity.quickActionsHintDismissed = domainEntity.quickActionsHintDismissed;
    ormEntity.financialMonthStartDay = domainEntity.financialMonthStartDay;
    ormEntity.createdAt = domainEntity.createdAt;

    return ormEntity;
  }
}
