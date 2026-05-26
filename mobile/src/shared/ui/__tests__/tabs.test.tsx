import { render, fireEvent } from '@testing-library/react-native';
import { Tabs } from '../tabs';

test('Tabs fires onChange on press', () => {
  const onChange = jest.fn();
  const { getByText } = render(
    <Tabs items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} value="a" onChange={onChange} />,
  );
  fireEvent.press(getByText('B'));
  expect(onChange).toHaveBeenCalledWith('b');
});
