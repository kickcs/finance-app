import { describe, it, expect } from 'vitest';
import type { Transaction } from '@/entities/transaction';
import { useBulkSelection } from './useBulkSelection';

function tx(id: string, extra: Partial<Transaction> = {}): Transaction {
  return { id, bulk_locked: false, payment_sibling: null, ...extra } as Transaction;
}

describe('useBulkSelection', () => {
  it('start входит в режим и отмечает строку, из которой начали', () => {
    const s = useBulkSelection();
    s.start(tx('a'));
    expect(s.isSelecting.value).toBe(true);
    expect([...s.selectedIds.value]).toEqual(['a']);
  });

  it('строка с замком не выбирается ни при start, ни при toggle', () => {
    const s = useBulkSelection();
    s.start(tx('a', { bulk_locked: true }));
    expect(s.isSelecting.value).toBe(true);
    expect(s.selectedIds.value.size).toBe(0);
    s.toggle(tx('a', { bulk_locked: true }));
    expect(s.selectedIds.value.size).toBe(0);
  });

  it('toggle ставит и снимает отметку', () => {
    const s = useBulkSelection();
    s.start();
    s.toggle(tx('a'));
    s.toggle(tx('b'));
    s.toggle(tx('a'));
    expect([...s.selectedIds.value]).toEqual(['b']);
  });

  it('пара оплаты отмечается и снимается обеими половинами', () => {
    const s = useBulkSelection();
    const half = tx('a', { payment_sibling: { id: 'b', account_id: 'x', amount: 1 } });
    s.start();
    s.toggle(half);
    expect([...s.selectedIds.value].sort()).toEqual(['a', 'b']);
    s.toggle(half);
    expect(s.selectedIds.value.size).toBe(0);
  });

  it('selectAll берёт только изменяемые строки списка, повторный вызов снимает всё', () => {
    const s = useBulkSelection();
    const rows = [tx('a'), tx('b', { bulk_locked: true }), tx('c')];
    s.start();
    s.selectAll(rows);
    expect([...s.selectedIds.value]).toEqual(['a', 'c']);
    expect(s.isAllSelected(rows)).toBe(true);
    s.selectAll(rows);
    expect(s.selectedIds.value.size).toBe(0);
  });

  it('exit сбрасывает режим и выбор', () => {
    const s = useBulkSelection();
    s.start(tx('a'));
    s.exit();
    expect(s.isSelecting.value).toBe(false);
    expect(s.selectedIds.value.size).toBe(0);
  });

  it('prune убирает отметки со строк, которых больше нет в списке', () => {
    const s = useBulkSelection();
    s.start();
    s.toggle(tx('a'));
    s.toggle(tx('b'));
    s.prune([tx('b')]);
    expect([...s.selectedIds.value]).toEqual(['b']);
  });

  it('prune не трогает вторую половину пары, которой нет на экране', () => {
    const s = useBulkSelection();
    const half = tx('a', { payment_sibling: { id: 'b', account_id: 'x', amount: 1 } });
    s.start();
    s.toggle(half);
    s.prune([half]);
    expect([...s.selectedIds.value].sort()).toEqual(['a', 'b']);
    // Ушла видимая половина — уходит и вторая
    s.prune([]);
    expect(s.selectedIds.value.size).toBe(0);
  });

  it('selectableCount считает и невидимые половины пар: выбранных не больше, чем можно выбрать', () => {
    const s = useBulkSelection();
    const half = tx('a', { payment_sibling: { id: 'b', account_id: 'x', amount: 1 } });
    const rows = [half, tx('c'), tx('d', { bulk_locked: true })];
    s.start();
    s.selectAll(rows);
    expect(s.selectableCount(rows)).toBe(3);
    expect(s.selectedCount.value).toBe(3);
    expect(s.isAllSelected(rows)).toBe(true);
  });
});
