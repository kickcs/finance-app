import { ref, computed } from 'vue';
import { REMINDER_ICONS, remindersApi, reminderQueryKeys } from '@/entities/reminder';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { queryClient } from '@/shared/api/queryClient';
import { useToast } from '@/shared/ui';
import { toLocalISODate } from '@/shared/lib/date';

export interface ReminderFormData {
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once';
  next_date: string;
  icon: string;
  color: string;
}

function getDefaultNextDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return toLocalISODate(date);
}

export function useCreateReminder() {
  const { toast } = useToast();
  const formData = ref<ReminderFormData>({
    name: '',
    amount: 0,
    frequency: 'monthly',
    next_date: getDefaultNextDate(),
    icon: REMINDER_ICONS[0],
    color: ENTITY_COLORS[0],
  });

  const isValid = computed(() => {
    return formData.value.name.trim().length > 0 && formData.value.amount > 0;
  });

  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  async function createReminder(userId: string) {
    if (!isValid.value) {
      error.value = 'Заполните все обязательные поля';
      return null;
    }

    isSubmitting.value = true;
    error.value = null;

    try {
      const data = await remindersApi.create({
        user_id: userId,
        name: formData.value.name.trim(),
        amount: formData.value.amount,
        frequency: formData.value.frequency,
        next_date: formData.value.next_date,
        icon: formData.value.icon,
        color: formData.value.color,
        is_active: true,
      });

      // Invalidate reminders cache to update the list
      await queryClient.invalidateQueries({
        queryKey: reminderQueryKeys.list(userId),
      });

      toast({
        title: 'Подписка создана',
        description: `Подписка "${formData.value.name}" добавлена`,
        variant: 'success',
        duration: 2500,
      });

      return data.id;
    } catch (e) {
      error.value = 'Не удалось создать подписку';
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать подписку',
        variant: 'error',
        duration: 4000,
      });
      console.error('Failed to create reminder:', e);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  }

  function updateField<K extends keyof ReminderFormData>(field: K, value: ReminderFormData[K]) {
    formData.value[field] = value;
  }

  function resetForm() {
    formData.value = {
      name: '',
      amount: 0,
      frequency: 'monthly',
      next_date: getDefaultNextDate(),
      icon: REMINDER_ICONS[0],
      color: ENTITY_COLORS[0],
    };
    error.value = null;
  }

  return {
    formData,
    isValid,
    isSubmitting,
    error,
    createReminder,
    updateField,
    resetForm,
  };
}
