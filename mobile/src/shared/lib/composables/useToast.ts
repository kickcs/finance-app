import { toast as sonnerToast } from 'sonner-native';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
};

export function toast(input: ToastInput): void {
  const { title, description, variant = 'default', action } = input;
  const opts = action ? { description, action } : { description };
  switch (variant) {
    case 'success':
      sonnerToast.success(title, opts);
      return;
    case 'error':
      sonnerToast.error(title, opts);
      return;
    case 'warning':
      sonnerToast.warning(title, opts);
      return;
    default:
      sonnerToast(title, opts);
  }
}

// Hook form for ergonomic call sites that already follow useX convention.
export function useToast() {
  return { toast };
}
