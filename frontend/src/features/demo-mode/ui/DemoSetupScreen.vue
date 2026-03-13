<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UProgressBar, UIcon } from '@/shared/ui';
import { useAuth } from '@/shared/api/composables/useAuth';
import { HttpError } from '@/shared/api/http';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'complete'): void;
  (e: 'error', message: string): void;
}>();

const { signInAnonymously } = useAuth();

const STEPS = [
  { title: 'Создаём профиль', subtitle: 'Ваш аккаунт готов' },
  { title: 'Добавляем счета', subtitle: 'Кошелёк, карты, накопления' },
  { title: 'Генерируем историю', subtitle: 'Транзакции за последний месяц' },
  { title: 'Финальные штрихи', subtitle: 'Долги, напоминания, контакты' },
] as const;

const STEP_INTERVAL = 600;
const COMPLETE_DELAY = 400;

const currentStep = ref(1);
const apiDone = ref(false);
const allDone = ref(false);

// Timers for steps 2, 3, 4 (step 1 shows immediately)
const stepTimer2 = useTimeoutFn(
  () => {
    currentStep.value = 2;
  },
  STEP_INTERVAL,
  { immediate: false },
);
const stepTimer3 = useTimeoutFn(
  () => {
    currentStep.value = 3;
  },
  STEP_INTERVAL * 2,
  { immediate: false },
);
const stepTimer4 = useTimeoutFn(
  () => {
    currentStep.value = 4;
    tryComplete();
  },
  STEP_INTERVAL * 3,
  { immediate: false },
);
const completeTimer = useTimeoutFn(
  () => {
    emit('complete');
  },
  COMPLETE_DELAY,
  { immediate: false },
);

const stepTimers = [stepTimer2, stepTimer3, stepTimer4];

function stopAllTimers() {
  stepTimers.forEach((t) => t.stop());
  completeTimer.stop();
}

function tryComplete() {
  if (currentStep.value >= STEPS.length && apiDone.value) {
    allDone.value = true;
    completeTimer.start();
  }
}

const progress = computed(() => {
  if (allDone.value) return 100;
  const stepProgress = [25, 50, 75, 88];
  return stepProgress[currentStep.value - 1] ?? 0;
});

const currentStepData = computed(() => STEPS[currentStep.value - 1]);

watch(
  () => props.visible,
  async (show) => {
    if (!show) {
      stopAllTimers();
      return;
    }

    currentStep.value = 1;
    apiDone.value = false;
    allDone.value = false;

    stepTimers.forEach((t) => t.start());

    try {
      await signInAnonymously();
      apiDone.value = true;
      tryComplete();
    } catch (err) {
      stopAllTimers();
      const message =
        err instanceof HttpError && err.status === 429
          ? 'Слишком много запросов. Попробуйте позже.'
          : 'Не удалось запустить демо режим';
      emit('error', message);
    }
  },
);

onUnmounted(() => stopAllTimers());
</script>

<template>
  <Transition name="demo-overlay">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background-light dark:bg-background-dark"
    >
      <div class="flex flex-col items-center gap-8 px-6 w-full max-w-sm">
        <!-- Stepper circles -->
        <div class="flex items-center gap-0">
          <template v-for="(_, index) in STEPS" :key="index">
            <div
              v-if="index > 0"
              class="w-8 h-0.5 transition-colors duration-300"
              :class="currentStep > index ? 'bg-success' : 'bg-border-light dark:bg-border-dark'"
            />
            <div
              class="relative flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 shrink-0"
              :class="[
                currentStep > index + 1 || (index + 1 === STEPS.length && allDone)
                  ? 'bg-success'
                  : currentStep === index + 1
                    ? 'border-2 border-primary'
                    : 'border-2 border-border-light dark:border-border-dark',
              ]"
            >
              <UIcon
                v-if="currentStep > index + 1 || (index + 1 === STEPS.length && allDone)"
                name="check"
                size="xs"
                class="text-white"
              />
              <div
                v-else-if="currentStep === index + 1"
                class="w-[7px] h-[7px] rounded-full bg-primary animate-pulse"
              />
            </div>
          </template>
        </div>

        <!-- Step text with fade transition -->
        <div class="text-center min-h-[56px] flex flex-col items-center justify-center">
          <Transition name="step-text" mode="out-in">
            <div :key="currentStep" class="flex flex-col items-center gap-1">
              <p
                class="text-body-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                {{ currentStepData.title }}
              </p>
              <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
                {{ currentStepData.subtitle }}
              </p>
            </div>
          </Transition>
        </div>

        <!-- Progress bar -->
        <div class="w-full max-w-[200px]">
          <UProgressBar :value="progress" size="sm" color="primary" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.demo-overlay-enter-active {
  transition: opacity 0.2s ease-out;
}
.demo-overlay-leave-active {
  transition: opacity 0.15s ease-in;
}
.demo-overlay-enter-from,
.demo-overlay-leave-to {
  opacity: 0;
}

.step-text-enter-active {
  transition: all 0.2s ease-out;
}
.step-text-leave-active {
  transition: all 0.15s ease-in;
}
.step-text-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.step-text-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
