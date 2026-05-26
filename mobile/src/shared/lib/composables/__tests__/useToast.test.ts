import { toast } from '../useToast';
import * as sonner from 'sonner-native';

jest.mock('sonner-native', () => {
  const fn: any = jest.fn();
  fn.success = jest.fn();
  fn.error = jest.fn();
  fn.warning = jest.fn();
  return { toast: fn };
});

test('toast() default calls sonner toast', () => {
  toast({ title: 'hi' });
  expect((sonner.toast as unknown as jest.Mock)).toHaveBeenCalledWith('hi', { description: undefined });
});

test('toast() success calls sonner toast.success', () => {
  toast({ title: 'ok', variant: 'success', description: 'done' });
  expect(sonner.toast.success).toHaveBeenCalledWith('ok', { description: 'done' });
});

test('toast() with action passes action through', () => {
  const onClick = jest.fn();
  toast({ title: 'err', variant: 'error', action: { label: 'Retry', onClick } });
  expect(sonner.toast.error).toHaveBeenCalledWith('err', { description: undefined, action: { label: 'Retry', onClick } });
});
