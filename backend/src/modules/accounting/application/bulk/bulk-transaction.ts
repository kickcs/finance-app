import type { DataSource, EntityManager } from 'typeorm';
import type { DomainEventPublisher } from '../../../../shared';
import type { AggregateRoot } from '../../../../shared/domain/base';

/**
 * Транзакция массовой операции: агрегаты, сложенные `work` в `changed`, публикуют события только
 * после коммита, а при откате — никогда.
 */
export async function runBulkTransaction<T>(
  dataSource: DataSource,
  eventPublisher: DomainEventPublisher,
  work: (manager: EntityManager, changed: AggregateRoot[]) => Promise<T>,
): Promise<T> {
  const changed: AggregateRoot[] = [];
  const result = await dataSource.transaction((manager) => work(manager, changed));
  for (const aggregate of changed) {
    await eventPublisher.publishEvents(aggregate);
  }
  return result;
}
