import type { DataSource, EntityManager } from 'typeorm';

/** Работает в транзакции вызывающего, если он её передал, иначе открывает свою. */
export function runInTransaction<T>(
  dataSource: DataSource,
  manager: EntityManager | undefined,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return manager ? work(manager) : dataSource.transaction(work);
}
