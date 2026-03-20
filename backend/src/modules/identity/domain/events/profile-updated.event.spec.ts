import { ProfileUpdatedEvent } from './profile-updated.event';

describe('ProfileUpdatedEvent', () => {
  it('should create event with correct properties', () => {
    const changes = { name: 'New Name', currency: 'USD' };
    const event = new ProfileUpdatedEvent('profile-1', changes);

    expect(event.profileId).toBe('profile-1');
    expect(event.changes).toEqual(changes);
    expect(event.eventName).toBe('profile.updated');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.eventId).toBeDefined();
  });
});
