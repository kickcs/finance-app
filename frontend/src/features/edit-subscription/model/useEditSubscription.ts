import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  recurringSubscriptionApi,
  recurringSubscriptionQueryKeys,
  useRecurringSubscriptions,
  type RecurringSubscription,
  type RecurringSubscriptionInsert,
} from '@/entities/recurring-subscription';
import { useToast } from '@/shared/ui';

export function useEditSubscription(
  userId: MaybeRefOrGetter<string | null>,
  subscriptionId: MaybeRefOrGetter<string | null>,
) {
  const { toast } = useToast();
  const { updateSubscription, deleteSubscription, pauseSubscription, resumeSubscription } =
    useRecurringSubscriptions(userId);

  const formData = ref<RecurringSubscriptionInsert>({
    name: '',
    amount: 0,
    currency: 'USD',
    icon: 'subscriptions',
    color: '#6366f1',
    frequency: 'monthly',
    billing_date: '',
    notify_days_before: [2],
    auto_charge: false,
    category_id: 'entertainment',
  });

  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  // Fetch subscription detail
  const queryKey = computed(() => {
    const id = toValue(subscriptionId);
    return id ? recurringSubscriptionQueryKeys.detail(id) : recurringSubscriptionQueryKeys.all;
  });

  const { data: subscription, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const id = toValue(subscriptionId);
      if (!id) return null;
      return recurringSubscriptionApi.getById(id);
    },
    enabled: computed(() => !!toValue(subscriptionId)),
  });

  // Populate form when subscription loads
  watch(
    subscription,
    (sub) => {
      if (sub) {
        formData.value = {
          name: sub.name,
          description: sub.description ?? undefined,
          amount: sub.amount,
          currency: sub.currency,
          account_id: sub.account_id ?? undefined,
          icon: sub.icon,
          color: sub.color,
          frequency: sub.frequency,
          frequency_days: sub.frequency_days ?? undefined,
          billing_date: sub.billing_date,
          notify_days_before: sub.notify_days_before,
          category_id: sub.category_id,
          auto_charge: sub.auto_charge,
        };
      }
    },
    { immediate: true },
  );

  const isValid = computed(() => {
    return (
      formData.value.name.trim().length > 0 &&
      formData.value.amount > 0 &&
      formData.value.currency !== '' &&
      formData.value.billing_date !== ''
    );
  });

  const isPaused = computed(() => subscription.value?.status === 'paused');

  async function saveSubscription(): Promise<boolean> {
    const id = toValue(subscriptionId);
    if (!id || !isValid.value) {
      error.value = 'Заполните все обязательные поля';
      return false;
    }

    isSubmitting.value = true;
    error.value = null;

    try {
      const updates: Partial<RecurringSubscription> = {
        name: formData.value.name,
        description: formData.value.description ?? null,
        amount: formData.value.amount,
        currency: formData.value.currency,
        account_id: formData.value.account_id ?? null,
        icon: formData.value.icon,
        color: formData.value.color,
        frequency: formData.value.frequency,
        frequency_days: formData.value.frequency_days ?? null,
        billing_date: formData.value.billing_date,
        notify_days_before: formData.value.notify_days_before,
        category_id: formData.value.category_id,
        auto_charge: formData.value.auto_charge,
      };

      await updateSubscription(id, updates);

      toast({
        title: 'Подписка обновлена',
        description: `${formData.value.name} сохранена`,
        variant: 'success',
        duration: 2500,
      });
      return true;
    } catch {
      error.value = 'Не удалось обновить подписку';
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить подписку',
        variant: 'error',
        duration: 4000,
      });
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function togglePause(): Promise<boolean> {
    const id = toValue(subscriptionId);
    if (!id) return false;

    try {
      if (isPaused.value) {
        await resumeSubscription(id);
        toast({
          title: 'Подписка возобновлена',
          variant: 'success',
          duration: 2500,
        });
      } else {
        await pauseSubscription(id);
        toast({
          title: 'Подписка приостановлена',
          variant: 'success',
          duration: 2500,
        });
      }
      return true;
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить статус подписки',
        variant: 'error',
        duration: 4000,
      });
      return false;
    }
  }

  async function removeSubscription(): Promise<boolean> {
    const id = toValue(subscriptionId);
    if (!id) return false;

    try {
      await deleteSubscription(id);
      toast({
        title: 'Подписка удалена',
        variant: 'success',
        duration: 2500,
      });
      return true;
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить подписку',
        variant: 'error',
        duration: 4000,
      });
      return false;
    }
  }

  function updateField<K extends keyof RecurringSubscriptionInsert>(
    field: K,
    value: RecurringSubscriptionInsert[K],
  ) {
    formData.value = { ...formData.value, [field]: value };
  }

  return {
    subscription,
    formData,
    isLoading,
    isValid,
    isSubmitting,
    isPaused,
    error,
    saveSubscription,
    togglePause,
    removeSubscription,
    updateField,
  };
}
