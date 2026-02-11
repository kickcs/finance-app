import { IEvent } from '@nestjs/cqrs';

/**
 * Base Domain Event class
 * Domain Events represent something that happened in the domain
 */
export abstract class DomainEvent implements IEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredOn = new Date();
    this.eventId = crypto.randomUUID();
  }

  abstract get eventName(): string;
}
