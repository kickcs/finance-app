import { ref, computed } from 'vue';
import { trigger } from '../haptics';

export type ToastVariant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'undo'
  | 'transaction-success';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface TransactionToastData {
  amount: string;
  categoryName: string;
  accountName: string;
  onUndo: () => Promise<void>;
}

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
  transactionData?: TransactionToastData;
}

export type ToasterToast = Toast & {
  open: boolean;
};

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 300;

// Длительность материализуется здесь, чтобы полоска прогресса и таймер Reka
// читали одно значение, а не два независимых фолбэка.
export const TOAST_DURATION = 3000;

const toasts = ref<ToasterToast[]>([]);

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

function addToast(toast: Toast) {
  const id = toast.id || genId();

  // Success-карточка — самый крупный тост, и подтверждают их подряд: в очереди
  // импорта стопка из трёх закрывала пол-экрана. Новая гасит предыдущую.
  if (toast.variant === 'transaction-success') {
    for (const t of toasts.value) {
      if (t.variant === 'transaction-success' && t.open) dismissToast(t.id);
    }
  }

  const newToast: ToasterToast = {
    ...toast,
    id,
    duration: toast.duration ?? TOAST_DURATION,
    open: true,
  };

  toasts.value = [newToast, ...toasts.value].slice(0, TOAST_LIMIT);

  return id;
}

function updateToast(id: string, toast: Partial<ToasterToast>) {
  toasts.value = toasts.value.map((t) => (t.id === id ? { ...t, ...toast } : t));
}

function dismissToast(id: string) {
  updateToast(id, { open: false });

  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, TOAST_REMOVE_DELAY);
}

function dismissAll() {
  toasts.value.forEach((toast) => {
    dismissToast(toast.id);
  });
}

function triggerHaptics(variant?: ToastVariant) {
  if (variant === 'success' || variant === 'transaction-success') {
    trigger('success');
  } else if (variant === 'error') {
    trigger('error');
  } else if (variant === 'warning') {
    trigger('warning');
  } else {
    trigger('selection');
  }
}

function addToastWithHaptics(toast: Toast) {
  triggerHaptics(toast.variant);
  return addToast(toast);
}

export function useToast() {
  return {
    toasts: computed(() => toasts.value),
    toast: (props: Omit<Toast, 'id'>) => {
      const id = addToastWithHaptics({ ...props, id: genId() });
      return {
        id,
        dismiss: () => dismissToast(id),
        update: (updateProps: Partial<Toast>) => updateToast(id, updateProps),
      };
    },
    dismiss: dismissToast,
    dismissAll,
  };
}
