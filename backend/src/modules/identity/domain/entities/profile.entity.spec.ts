import { Profile } from './profile.entity';
import { Email } from '../value-objects/email.vo';
import { ProfileCreatedEvent } from '../events/profile-created.event';
import { type ProfileUpdatedEvent } from '../events/profile-updated.event';

describe('Profile Entity', () => {
  describe('createRegistered', () => {
    it('should create a registered profile with correct properties', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, 'John', 'hashed-pw', 'USD');

      expect(profile.id).toBe('id-1');
      expect(profile.emailValue).toBe('user@test.com');
      expect(profile.name).toBe('John');
      expect(profile.password).not.toBeNull();
      expect(profile.password!.hashedValue).toBe('hashed-pw');
      expect(profile.currency).toBe('USD');
      expect(profile.hasCompletedOnboarding).toBe(false);
      expect(profile.defaultAccountId).toBeNull();
      expect(profile.isDemo).toBe(false);
      expect(profile.demoExpiresAt).toBeNull();
      expect(profile.refreshToken).toBeNull();
      expect(profile.dashboardSettings).toBeNull();
      expect(profile.quickActionsHidden).toBe(false);
      expect(profile.quickActionsHintDismissed).toBe(false);
      expect(profile.createdAt).toBeInstanceOf(Date);
    });

    it('should default to RUB currency when none specified', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, null, 'hashed-pw');

      expect(profile.currency).toBe('RUB');
    });

    it('should raise a ProfileCreatedEvent', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, 'John', 'hashed-pw');
      const events = profile.domainEvents;

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProfileCreatedEvent);
      const event = events[0] as ProfileCreatedEvent;
      expect(event.profileId).toBe('id-1');
      expect(event.email).toBe('user@test.com');
      expect(event.isDemo).toBe(false);
    });

    it('should accept null name', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, null, 'hashed-pw');

      expect(profile.name).toBeNull();
    });
  });

  describe('createDemo', () => {
    it('should create a demo profile', () => {
      const expiresAt = new Date(Date.now() + 3600000);
      const profile = Profile.createDemo('id-2', expiresAt);

      expect(profile.id).toBe('id-2');
      expect(profile.emailValue).toBeNull();
      expect(profile.name).toBe('Demo User');
      expect(profile.password).toBeNull();
      expect(profile.currency).toBe('UZS');
      expect(profile.isDemo).toBe(true);
      expect(profile.demoExpiresAt).toBe(expiresAt);
      expect(profile.hasCompletedOnboarding).toBe(false);
    });

    it('should raise a ProfileCreatedEvent with isDemo=true', () => {
      const expiresAt = new Date(Date.now() + 3600000);
      const profile = Profile.createDemo('id-2', expiresAt);
      const events = profile.domainEvents;

      expect(events).toHaveLength(1);
      const event = events[0] as ProfileCreatedEvent;
      expect(event.profileId).toBe('id-2');
      expect(event.email).toBeNull();
      expect(event.isDemo).toBe(true);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a profile from props without raising events', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.reconstitute({
        id: 'id-3',
        email,
        name: 'Jane',
        password: null,
        currency: 'EUR',
        language: 'ru',
        hasCompletedOnboarding: true,
        defaultAccountId: 'acc-1',
        isDemo: false,
        demoExpiresAt: null,
        refreshToken: 'some-token',
        dashboardSettings: null,
        quickActionsHidden: false,
        quickActionsHintDismissed: false,
        financialMonthStartDay: 1,
        timezone: 'Asia/Tashkent',
        notificationHour: 12,
        createdAt: new Date('2024-01-01'),
      });

      expect(profile.id).toBe('id-3');
      expect(profile.name).toBe('Jane');
      expect(profile.currency).toBe('EUR');
      expect(profile.hasCompletedOnboarding).toBe(true);
      expect(profile.defaultAccountId).toBe('acc-1');
      expect(profile.domainEvents).toHaveLength(0);
    });
  });

  describe('updateProfile', () => {
    let profile: Profile;

    beforeEach(() => {
      const email = Email.create('user@test.com');
      profile = Profile.createRegistered('id-1', email, 'John', 'hashed-pw');
      profile.clearDomainEvents();
    });

    it('should update name and raise a ProfileUpdatedEvent', () => {
      profile.updateProfile({ name: 'Jane' });

      expect(profile.name).toBe('Jane');
      expect(profile.domainEvents).toHaveLength(1);
      const event = profile.domainEvents[0] as ProfileUpdatedEvent;
      expect(event.profileId).toBe('id-1');
      expect(event.changes).toEqual({ name: 'Jane' });
    });

    it('should update currency', () => {
      profile.updateProfile({ currency: 'EUR' });

      expect(profile.currency).toBe('EUR');
      const event = profile.domainEvents[0] as ProfileUpdatedEvent;
      expect(event.changes).toEqual({ currency: 'EUR' });
    });

    it('should update hasCompletedOnboarding', () => {
      profile.updateProfile({ hasCompletedOnboarding: true });

      expect(profile.hasCompletedOnboarding).toBe(true);
    });

    it('should update defaultAccountId', () => {
      profile.updateProfile({ defaultAccountId: 'acc-99' });

      expect(profile.defaultAccountId).toBe('acc-99');
    });

    it('should update dashboardSettings', () => {
      const settings = {
        widgetOrder: ['accounts' as const, 'transactions' as const],
        hiddenWidgets: [],
        hiddenAccountIds: [],
      };
      profile.updateProfile({ dashboardSettings: settings });

      expect(profile.dashboardSettings).toEqual(settings);
    });

    it('should update quickActionsHidden', () => {
      profile.updateProfile({ quickActionsHidden: true });

      expect(profile.quickActionsHidden).toBe(true);
    });

    it('should update quickActionsHintDismissed', () => {
      profile.updateProfile({ quickActionsHintDismissed: true });

      expect(profile.quickActionsHintDismissed).toBe(true);
    });

    it('should update multiple fields in one call', () => {
      profile.updateProfile({ name: 'Updated', currency: 'GBP' });

      expect(profile.name).toBe('Updated');
      expect(profile.currency).toBe('GBP');
      expect(profile.domainEvents).toHaveLength(1);
      const event = profile.domainEvents[0] as ProfileUpdatedEvent;
      expect(event.changes).toEqual({ name: 'Updated', currency: 'GBP' });
    });

    it('should not raise event when no changes provided', () => {
      profile.updateProfile({});

      expect(profile.domainEvents).toHaveLength(0);
    });
  });

  describe('setRefreshToken', () => {
    it('should set the refresh token', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, null, 'hashed-pw');

      profile.setRefreshToken('new-token-hash');
      expect(profile.refreshToken).toBe('new-token-hash');
    });

    it('should clear the refresh token', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, null, 'hashed-pw');

      profile.setRefreshToken('some-token');
      profile.setRefreshToken(null);
      expect(profile.refreshToken).toBeNull();
    });
  });

  describe('language', () => {
    it('defaults to "ru" for a registered profile when not provided', () => {
      const profile = Profile.createRegistered(
        'user-1',
        Email.create('u@test.com'),
        'John',
        'hashed',
      );
      expect(profile.language).toBe('ru');
    });

    it('uses the provided language on registration', () => {
      const profile = Profile.createRegistered(
        'user-1',
        Email.create('u@test.com'),
        'John',
        'hashed',
        'USD',
        'en',
      );
      expect(profile.language).toBe('en');
    });

    it('updates language via updateProfile', () => {
      const profile = Profile.createRegistered(
        'user-1',
        Email.create('u@test.com'),
        'John',
        'hashed',
      );
      profile.updateProfile({ language: 'en' });
      expect(profile.language).toBe('en');
    });
  });

  describe('isExpired', () => {
    it('should return false for a non-demo profile', () => {
      const email = Email.create('user@test.com');
      const profile = Profile.createRegistered('id-1', email, null, 'hashed-pw');

      expect(profile.isExpired()).toBe(false);
    });

    it('should return false for a demo profile that has not expired', () => {
      const futureDate = new Date(Date.now() + 3600000);
      const profile = Profile.createDemo('id-1', futureDate);

      expect(profile.isExpired()).toBe(false);
    });

    it('should return true for a demo profile that has expired', () => {
      const pastDate = new Date(Date.now() - 1000);
      const profile = Profile.createDemo('id-1', pastDate);

      expect(profile.isExpired()).toBe(true);
    });
  });
});
