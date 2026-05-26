import { render } from '@testing-library/react-native';
import { InitialAvatar } from '../initial-avatar';

test('InitialAvatar renders first character uppercase', () => {
  const { getByText } = render(<InitialAvatar name="ivan" />);
  expect(getByText('I')).toBeTruthy();
});

test('InitialAvatar falls back to ? when name empty', () => {
  const { getByText } = render(<InitialAvatar name="   " />);
  expect(getByText('?')).toBeTruthy();
});
