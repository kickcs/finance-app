import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { AggregateRoot } from '../../domain/base';

/**
 * Domain Event Publisher
 * Publishes domain events from aggregates to the NestJS CQRS EventBus
 */
@Injectable()
export class DomainEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Publish all domain events from an aggregate and clear them
   */
  async publishEvents(aggregate: AggregateRoot): Promise<void> {
    const events = aggregate.domainEvents;

    for (const event of events) {
      await this.eventBus.publish(event);
    }

    aggregate.clearDomainEvents();
  }

  /**
   * Publish events from multiple aggregates
   */
  async publishEventsFromMultiple(aggregates: AggregateRoot[]): Promise<void> {
    for (const aggregate of aggregates) {
      await this.publishEvents(aggregate);
    }
  }
}
