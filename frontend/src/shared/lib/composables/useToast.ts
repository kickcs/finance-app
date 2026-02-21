import { ref, computed } from 'vue';
import { haptics } from '../haptics';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

export type ToasterToast = Toast & {
  open: boolean;
};

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 300;

const toasts = ref<ToasterToast[]>([]);

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

function triggerHaptics(variant?: ToastVariant) {
  if (variant === 'success') {
    haptics.success();
  } else if (variant === 'error') {
    haptics.error();
  } else if (variant === 'warning') {
    haptics.warning();
  } else {
    haptics.tap();
  }
}

function addToast(toast: Toast) {
  const id = toast.id || genId();

  const newToast: ToasterToast = {
    ...toast,
    id,
    open: true,
  };

  triggerHaptics(toast.variant);

  toasts.value = [newToast, ...toasts.value].slice(0, TOAST_LIMIT);

  return id;
}

function updateToast(id: string, toast: Partial<ToasterToast>) {
  toasts.value = toasts.value.map((t) =>
    t.id === id ? { ...t, ...toast } : t,
  );
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

export function useToast() {
  return {
    toasts: computed(() => toasts.value),
    toast: (props: Omit<Toast, 'id'>) => {
      const id = addToast({ ...props, id: genId() });
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
