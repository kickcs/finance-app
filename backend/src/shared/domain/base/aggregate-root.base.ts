import { AggregateRoot as NestAggregateRoot } from '@nestjs/cqrs';
import type { DomainEvent } from './domain-event.base';

/**
 * Base Aggregate Root class
 * Aggregates are clusters of domain objects that can be treated as a single unit
 */
export abstract class AggregateRoot<TId = string> extends NestAggregateRoot {
  protected readonly _id: TId;
  private _domainEvents: DomainEvent[] = [];

  constructor(id: TId) {
    super();
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this.apply(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  equals(other: AggregateRoot<TId>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return this._id === other._id;
  }
}
