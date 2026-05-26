import { render, fireEvent } from '@testing-library/react-native';
import { SelectChips } from '../select-chips';

test('SelectChips fires onChange when chip pressed', () => {
  const onChange = jest.fn();
  const { getByText } = render(
    <SelectChips items={[{ id: 'usd', label: 'USD' }, { id: 'eur', label: 'EUR' }]} value="usd" onChange={onChange} />,
  );
  fireEvent.press(getByText('EUR'));
  expect(onChange).toHaveBeenCalledWith('eur');
});
