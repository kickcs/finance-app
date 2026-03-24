<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, useToast } from '@/shared/ui';
import { useProfile } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import { getFinancialMonthBounds, formatFinancialPeriod } from '@/shared/lib/utils/financialPeriod';
import { transactionQueryKeys } from '@/entities/transaction';
import { budgetQueryKeys } from '@/entities/budget';
import { useQueryClient } from '@tanstack/vue-query';

const model = defineModel<boolean>({ required: true });

const { userId } = useCurrentUser();
const { profile, updateProfile } = useProfile(userId);
const { toast } = useToast();
const { trigger } = useHaptics();
const queryClient = useQueryClient();

const currentStartDay = computed(() => profile.value?.financial_month_start_day ?? 1);
const selectedDay = ref(currentStartDay.value);

// Sync selectedDay when modal opens
watch(
  () => model.value,
  (open) => {
    if (open) selectedDay.value = currentStartDay.value;
  },
);

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const previewLabel = computed(() =>
  formatFinancialPeriod(currentYear, currentMonth, selectedDay.value),
);

const daysInPeriod = computed(() => {
  const { start, end } = getFinancialMonthBounds(currentYear, currentMonth, selectedDay.value);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
});

const isChanged = computed(() => selectedDay.value !== currentStartDay.value);
const isChangingFromCustom = computed(() => currentStartDay.value !== 1 && isChanged.value);

const isSaving = ref(false);

function selectDay(day: number) {
  selectedDay.value = day;
  trigger('selection');
}

async function save() {
  isSaving.value = true;
  try {
    await updateProfile({ financial_month_start_day: selectedDay.value });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionQueryKeys.monthlyStatsPrefix() }),
      queryClient.invalidateQueries({ queryKey: transactionQueryKeys.analyticsStatsPrefix() }),
      queryClient.invalidateQueries({ queryKey: transactionQueryKeys.dailyStatsPrefix() }),
      queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all }),
    ]);
    trigger('success');
    toast({ title: 'Начало месяца обновлено', variant: 'default' });
    model.value = false;
  } catch {
    trigger('error');
    toast({ title: 'Ошибка сохранения', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <UModal v-model="model" title="Начало финансового месяца">
    <div class="space-y-5">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Выберите день, с которого начинается ваш финансовый месяц. Обычно это день получения
        зарплаты.
      </p>

      <!-- Day Grid -->
      <div class="space-y-1.5">
        <div class="grid grid-cols-7 gap-1.5">
          <button
            v-for="day in 31"
            :key="day"
            :class="[
              'h-10 rounded-lg text-sm font-medium transition-all',
              day === selectedDay
                ? 'bg-primary text-white shadow-sm scale-105'
                : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/10 text-text-primary-light dark:text-text-primary-dark',
            ]"
            @click="selectDay(day)"
          >
            {{ day }}
          </button>
        </div>

        <p
          v-if="selectedDay > 28"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          В коротких месяцах будет использоваться последний доступный день (напр. 28-е в феврале)
        </p>

        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          Если вы получаете зарплату дважды в месяц, укажите день первой выплаты
        </p>
      </div>

      <!-- Live Preview -->
      <div class="rounded-xl bg-surface-light dark:bg-surface-dark p-4 space-y-1.5">
        <p
          class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
        >
          Ваш текущий период
        </p>
        <p class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ previewLabel }}
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ daysInPeriod }} дней в периоде
        </p>
      </div>

      <!-- Warning -->
      <div v-if="isChangingFromCustom" class="rounded-lg bg-warning/10 p-3 text-sm text-warning">
        Смена дня начала пересчитает статистику за все месяцы. Исторические данные будут
        перегруппированы по новым границам.
      </div>
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="model = false">Отмена</UButton>
      <UButton
        variant="primary"
        full-width
        :disabled="!isChanged || isSaving"
        :loading="isSaving"
        @click="save"
      >
        Сохранить
      </UButton>
    </template>
  </UModal>
</template>
