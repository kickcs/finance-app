import { pluralize } from '../pluralize';

const forms: [string, string, string] = ['рубль', 'рубля', 'рублей'];

test('pluralize ru rules', () => {
  expect(pluralize(1, forms)).toBe('рубль');
  expect(pluralize(2, forms)).toBe('рубля');
  expect(pluralize(5, forms)).toBe('рублей');
  expect(pluralize(11, forms)).toBe('рублей');
  expect(pluralize(21, forms)).toBe('рубль');
  expect(pluralize(0, forms)).toBe('рублей');
});
