import type { EntityManager } from 'typeorm';

/**
 * Массовые операции одного пользователя идут по очереди: строки запираются двумя запросами, и две
 * параллельные правки одной пары иначе могли бы ждать друг друга по кругу.
 */
export async function lockBulkOperations(manager: EntityManager, userId: string): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bulk-edit:${userId}`]);
}
