import { ProfileCreatedEvent } from './profile-created.event';

describe('ProfileCreatedEvent', () => {
  it('should create event with correct properties', () => {
    const event = new ProfileCreatedEvent('profile-1', 'user@test.com', false);

    expect(event.profileId).toBe('profile-1');
    expect(event.email).toBe('user@test.com');
    expect(event.isDemo).toBe(false);
    expect(event.eventName).toBe('profile.created');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.eventId).toBeDefined();
  });

  it('should create event for demo profile with null email', () => {
    const event = new ProfileCreatedEvent('profile-2', null, true);

    expect(event.email).toBeNull();
    expect(event.isDemo).toBe(true);
  });
});
