import { ProfileMapper } from './profile.mapper';
import { ProfileOrmEntity } from '../typeorm/profile.orm-entity';
import { Profile, Email } from '../../../domain';

describe('ProfileMapper', () => {
  describe('toDomain', () => {
    it('should map a full ORM entity to a domain entity', () => {
      const orm = new ProfileOrmEntity();
      orm.id = 'user-1';
      orm.email = 'user@test.com';
      orm.name = 'John';
      orm.passwordHash = 'hashed-pw';
      orm.currency = 'USD';
      orm.hasCompletedOnboarding = true;
      orm.defaultAccountId = 'acc-1';
      orm.isDemo = false;
      orm.demoExpiresAt = null;
      orm.refreshToken = 'refresh-hash';
      orm.dashboardSettings = {
        widgetOrder: ['accounts'],
        hiddenWidgets: [],
        hiddenAccountIds: [],
      };
      orm.quickActionsHidden = false;
      orm.quickActionsHintDismissed = true;
      orm.timezone = 'Asia/Tashkent';
      orm.createdAt = new Date('2024-01-01');

      const domain = ProfileMapper.toDomain(orm);

      expect(domain.id).toBe('user-1');
      expect(domain.emailValue).toBe('user@test.com');
      expect(domain.name).toBe('John');
      expect(domain.password!.hashedValue).toBe('hashed-pw');
      expect(domain.currency).toBe('USD');
      expect(domain.hasCompletedOnboarding).toBe(true);
      expect(domain.defaultAccountId).toBe('acc-1');
      expect(domain.isDemo).toBe(false);
      expect(domain.refreshToken).toBe('refresh-hash');
      expect(domain.quickActionsHintDismissed).toBe(true);
    });

    it('should handle null email and password', () => {
      const orm = new ProfileOrmEntity();
      orm.id = 'user-2';
      orm.email = null;
      orm.name = 'Demo';
      orm.passwordHash = null;
      orm.currency = 'UZS';
      orm.hasCompletedOnboarding = false;
      orm.defaultAccountId = null;
      orm.isDemo = true;
      orm.demoExpiresAt = new Date('2025-01-01');
      orm.refreshToken = null;
      orm.dashboardSettings = null;
      orm.quickActionsHidden = false;
      orm.quickActionsHintDismissed = false;
      orm.timezone = 'Asia/Tashkent';
      orm.createdAt = new Date('2024-12-31');

      const domain = ProfileMapper.toDomain(orm);

      expect(domain.email).toBeNull();
      expect(domain.password).toBeNull();
      expect(domain.isDemo).toBe(true);
      expect(domain.demoExpiresAt).toEqual(new Date('2025-01-01'));
    });
  });

  describe('toOrm', () => {
    it('should map a domain entity to an ORM entity', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.reconstitute({
        id: 'user-1',
        email,
        name: 'John',
        password: null,
        currency: 'USD',
        hasCompletedOnboarding: true,
        defaultAccountId: 'acc-1',
        isDemo: false,
        demoExpiresAt: null,
        refreshToken: 'refresh-hash',
        dashboardSettings: {
          widgetOrder: ['accounts'],
          hiddenWidgets: [],
          hiddenAccountIds: [],
        },
        quickActionsHidden: true,
        quickActionsHintDismissed: false,
        financialMonthStartDay: 1,
        timezone: 'Asia/Tashkent',
        notificationHour: 12,
        createdAt: new Date('2024-01-01'),
      });

      const orm = ProfileMapper.toOrm(profile);

      expect(orm).toBeInstanceOf(ProfileOrmEntity);
      expect(orm.id).toBe('user-1');
      expect(orm.email).toBe('user@test.com');
      expect(orm.name).toBe('John');
      expect(orm.passwordHash).toBeNull();
      expect(orm.currency).toBe('USD');
      expect(orm.hasCompletedOnboarding).toBe(true);
      expect(orm.defaultAccountId).toBe('acc-1');
      expect(orm.isDemo).toBe(false);
      expect(orm.refreshToken).toBe('refresh-hash');
      expect(orm.quickActionsHidden).toBe(true);
    });

    it('should roundtrip: toDomain -> toOrm preserves data', () => {
      const orm = new ProfileOrmEntity();
      orm.id = 'user-1';
      orm.email = 'test@example.com';
      orm.name = 'Test';
      orm.passwordHash = 'hash';
      orm.currency = 'EUR';
      orm.hasCompletedOnboarding = false;
      orm.defaultAccountId = null;
      orm.isDemo = false;
      orm.demoExpiresAt = null;
      orm.refreshToken = null;
      orm.dashboardSettings = null;
      orm.quickActionsHidden = false;
      orm.quickActionsHintDismissed = false;
      orm.financialMonthStartDay = 1;
      orm.timezone = 'Asia/Tashkent';
      orm.createdAt = new Date('2024-06-15');

      const domain = ProfileMapper.toDomain(orm);
      const roundtripped = ProfileMapper.toOrm(domain);

      expect(roundtripped.id).toBe(orm.id);
      expect(roundtripped.email).toBe(orm.email);
      expect(roundtripped.name).toBe(orm.name);
      expect(roundtripped.passwordHash).toBe(orm.passwordHash);
      expect(roundtripped.currency).toBe(orm.currency);
      expect(roundtripped.hasCompletedOnboarding).toBe(orm.hasCompletedOnboarding);
      expect(roundtripped.isDemo).toBe(orm.isDemo);
      expect(roundtripped.createdAt).toEqual(orm.createdAt);
    });
  });
});
