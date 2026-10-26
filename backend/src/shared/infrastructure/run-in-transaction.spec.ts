import type { DataSource, EntityManager } from 'typeorm';
import { runInTransaction } from './run-in-transaction';

describe('runInTransaction', () => {
  const inner = { id: 'inner' } as unknown as EntityManager;
  const transaction = jest.fn((work: (m: EntityManager) => Promise<unknown>) => work(inner));
  const dataSource = { transaction } as unknown as DataSource;

  beforeEach(() => jest.clearAllMocks());

  it('с менеджером вызывающего работает на нём и своей транзакции не открывает', async () => {
    const outer = { id: 'outer' } as unknown as EntityManager;
    const work = jest.fn().mockResolvedValue('result');

    await expect(runInTransaction(dataSource, outer, work)).resolves.toBe('result');

    expect(work).toHaveBeenCalledWith(outer);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('без менеджера открывает одну транзакцию и отдаёт её менеджер', async () => {
    const work = jest.fn().mockResolvedValue('result');

    await expect(runInTransaction(dataSource, undefined, work)).resolves.toBe('result');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(inner);
  });
});
