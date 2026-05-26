import { renderHook, act } from '@testing-library/react-native';
import { useSplitExpense } from '../useSplitExpense';

test('add/remove/setShare flow', () => {
  const { result } = renderHook(() => useSplitExpense());
  act(() => result.current.add('p1'));
  expect(result.current.participants).toEqual([{ personId: 'p1', share: 0 }]);
  act(() => result.current.setShare('p1', 50));
  expect(result.current.totalShared).toBe(50);
  act(() => result.current.add('p1')); // no-op (already added)
  expect(result.current.participants).toHaveLength(1);
  act(() => result.current.remove('p1'));
  expect(result.current.participants).toEqual([]);
});
