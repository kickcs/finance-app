import { getInitial } from '../text';

test('getInitial', () => {
  expect(getInitial('ivan')).toBe('I');
  expect(getInitial('   ')).toBe('?');
  expect(getInitial('')).toBe('?');
});
