import { getGreeting } from '../greeting';

test('getGreeting buckets', () => {
  expect(getGreeting(2)).toBe('Доброй ночи');
  expect(getGreeting(9)).toBe('Доброе утро');
  expect(getGreeting(14)).toBe('Добрый день');
  expect(getGreeting(20)).toBe('Добрый вечер');
});
