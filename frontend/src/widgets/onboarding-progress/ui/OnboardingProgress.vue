<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue';
import { UCard, UProgressBar, UIcon } from '@/shared/ui';
import { useTransactions } from '@/entities/transaction';
import { useRouter } from 'vue-router';
import { haptics } from '@/shared/lib/haptics';
import { useLocalStorage } from '@/shared/lib/hooks/useLocalStorage';

const props = defineProps<{
  userId: string;
}>();

const router = useRouter();

const { transactions } = useTransactions(computed(() => props.userId));

const hasFirstTransaction = computed(() => (transactions.value?.length ?? 0) > 0);

const stepsCompleted = computed(() => {
  let count = 1; // Account is already done
  if (hasFirstTransaction.value) count++;
  return count;
});

const progressPercentage = computed(() => Math.round((stepsCompleted.value / 2) * 100));

const isFullyOnboarded = useLocalStorage('isFullyOnboarded', false);
const showConfetti = ref(false);

watch(stepsCompleted, (newVal, oldVal) => {
  if (newVal === 2 && oldVal < 2 && !isFullyOnboarded.value) {
    showConfetti.value = true;
    haptics.success();
    setTimeout(() => {
      isFullyOnboarded.value = true;
    }, 2000);
  }
});

onMounted(() => {
  // If user already completed everything before this feature was introduced
  if (stepsCompleted.value === 2 && !isFullyOnboarded.value) {
    isFullyOnboarded.value = true;
  }
});

function navigateToNewTransaction() {
  haptics.tap();
  router.push('/transactions/new');
}

function dismiss() {
  isFullyOnboarded.value = true;
}
</script>

<template>
  <div v-if="!isFullyOnboarded" class="mb-6">
    <UCard variant="default" class="relative overflow-hidden border-primary/20 bg-primary/5 dark:bg-primary/10">
      <div class="p-4">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="font-bold text-text-primary-light dark:text-text-primary-dark">
              Настройка профиля
            </h3>
            <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
              Пройдите 2 шага для старта
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-primary">{{ progressPercentage }}%</span>
            <button @click="dismiss" class="text-text-tertiary-light dark:text-text-tertiary-dark p-1 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark transition-colors">
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </div>

        <UProgressBar 
          :value="progressPercentage" 
          :max="100" 
          color="primary" 
          class="mb-4"
        />

        <div class="space-y-3">
          <!-- Step 1 -->
          <div class="flex items-center gap-3 opacity-60">
            <div class="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
              <UIcon name="check" size="sm" />
            </div>
            <span class="text-sm text-text-primary-light dark:text-text-primary-dark line-through decoration-text-tertiary-light">
              Создать первый счёт
            </span>
          </div>

          <!-- Step 2 -->
          <div 
            class="flex items-center gap-3 group cursor-pointer transition-opacity"
            :class="hasFirstTransaction ? 'opacity-60' : ''"
            @click="!hasFirstTransaction && navigateToNewTransaction()"
          >
            <div 
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              :class="hasFirstTransaction ? 'bg-success/20 text-success' : 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-tertiary-light'"
            >
              <UIcon v-if="hasFirstTransaction" name="check" size="sm" />
              <span v-else class="text-xs font-medium">2</span>
            </div>
            <div class="flex-1">
              <span 
                class="text-sm text-text-primary-light dark:text-text-primary-dark"
                :class="{ 'line-through decoration-text-tertiary-light': hasFirstTransaction }"
              >
                Записать первый расход
              </span>
            </div>
            <UIcon 
              v-if="!hasFirstTransaction" 
              name="chevron_right" 
              size="sm" 
              class="text-text-tertiary-light opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" 
            />
          </div>
        </div>
      </div>
      
      <!-- Confetti overlay -->
      <div 
        v-if="showConfetti" 
        class="absolute inset-0 bg-success/10 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300"
      >
        <div class="text-center animate-bounce">
          <div class="text-4xl mb-2">🎉</div>
          <p class="font-bold text-success">Готово!</p>
        </div>
      </div>
    </UCard>
  </div>
</template>