import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import {
  recurringSubscriptionApi,
  recurringSubscriptionQueryKeys,
  type RecurringSubscriptionInsert,
} from '@/entities/recurring-subscription';
import { useToast } from '@/shared/ui';
import { getTodayISO } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/entities/currency';

export type SubscriptionFormData = RecurringSubscriptionInsert;

function makeInitialFormData(): SubscriptionFormData {
  return {
    name: '',
    amount: 0,
    currency: DEFAULT_CURRENCY,
    icon: 'subscriptions',
    color: '#6366f1',
    frequency: 'monthly',
    billing_date: getTodayISO(),
    notify_days_before: [2],
    auto_charge: false,
    category_id: 'entertainment',
  };
}

export function useCreateSubscription(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const formData = ref<SubscriptionFormData>(makeInitialFormData());
  const error = ref<string | null>(null);

  const isValid = computed(() => {
    return (
      formData.value.name.trim().length > 0 &&
      formData.value.amount > 0 &&
      formData.value.currency !== '' &&
      formData.value.billing_date !== ''
    );
  });

  const mutation = useMutation({
    mutationFn: (data: SubscriptionFormData) => recurringSubscriptionApi.create(data),
    onSuccess: () => {
      if (toValue(userId)) {
        queryClient.invalidateQueries({
          queryKey: recurringSubscriptionQueryKeys.all,
        });
      }
      toast({
        title: 'Подписка создана',
        description: `${formData.value.name} добавлена`,
        variant: 'success',
        duration: 2500,
      });
      resetForm();
    },
    onError: () => {
      error.value = 'Не удалось создать подписку';
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать подписку',
        variant: 'error',
        duration: 4000,
      });
    },
  });

  const isSubmitting = computed(() => mutation.isPending.value);

  async function createSubscription(): Promise<boolean> {
    if (!isValid.value) {
      error.value = 'Заполните все обязательные поля';
      return false;
    }
    error.value = null;
    try {
      await mutation.mutateAsync(formData.value);
      return true;
    } catch {
      return false;
    }
  }

  function updateField<K extends keyof SubscriptionFormData>(
    field: K,
    value: SubscriptionFormData[K],
  ) {
    formData.value = { ...formData.value, [field]: value };
  }

  function resetForm() {
    formData.value = makeInitialFormData();
    error.value = null;
    mutation.reset();
  }

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    createSubscription,
    updateField,
    resetForm,
  };
}
