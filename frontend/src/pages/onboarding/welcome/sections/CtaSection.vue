<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { useAuth } from '@/shared/api/composables/useAuth';
import { useSectionAnimation } from '../composables';

const router = useRouter();
const { signInAnonymously } = useAuth();
const { sectionRef, isVisible } = useSectionAnimation();

const isDemoLoading = ref(false);
const demoError = ref('');

function markOnboardingSeen() {
  localStorage.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, 'true');
}

function handleStart() {
  markOnboardingSeen();
  router.push({ name: ROUTE_NAMES.LOGIN, query: { mode: 'register' } });
}

async function handleDemo() {
  markOnboardingSeen();
  isDemoLoading.value = true;
  demoError.value = '';
  try {
    const result = await signInAnonymously();
    if (result?.user) {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
      localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, result.user.currency);
      router.push({ name: ROUTE_NAMES.DASHBOARD });
    }
  } catch (e: unknown) {
    demoError.value =
      e instanceof Error && e.message.includes('429')
        ? 'Слишком много попыток. Попробуйте позже.'
        : 'Не удалось запустить демо. Попробуйте ещё раз.';
  } finally {
    isDemoLoading.value = false;
  }
}
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Начать"
    style="background: linear-gradient(180deg, #0c0820 0%, #1a1545 50%, #0c0820 100%)"
  >
    <!-- Ambient glows -->
    <div
      class="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.06] blur-[150px]"
      aria-hidden="true"
    />
    <div
      class="absolute left-[20%] top-[30%] h-[200px] w-[200px] rounded-full bg-violet-500/[0.04] blur-[80px]"
      aria-hidden="true"
    />
    <div
      class="absolute bottom-[30%] right-[20%] h-[200px] w-[200px] rounded-full bg-indigo-400/[0.04] blur-[80px]"
      aria-hidden="true"
    />

    <div
      class="relative z-10 flex flex-col items-center text-center transition-all duration-800"
      :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    >
      <h2 class="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
        <span
          class="bg-gradient-to-r from-white via-indigo-100 to-violet-200 bg-clip-text text-transparent"
        >
          Готовы взять финансы
        </span>
        <br />
        <span class="bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text text-transparent">
          под контроль?
        </span>
      </h2>
      <p class="mb-10 max-w-sm text-sm text-white/35">
        Присоединяйтесь бесплатно. Никаких скрытых платежей.
      </p>

      <div class="flex w-72 flex-col gap-3">
        <button
          class="cta-glow w-full rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 px-8 py-4 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          @click="handleStart"
        >
          Начать бесплатно
        </button>
        <button
          class="glass-card w-full rounded-xl px-8 py-3 text-sm text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
          :disabled="isDemoLoading"
          @click="handleDemo"
        >
          {{ isDemoLoading ? 'Загрузка...' : 'Попробовать демо' }}
        </button>
      </div>

      <p v-if="demoError" class="mt-4 text-xs text-red-400">{{ demoError }}</p>
      <p class="mt-6 text-[10px] tracking-wider text-white/20">
        Регистрация за 30 секунд · Без привязки карты
      </p>
    </div>
  </section>
</template>

<style scoped>
.cta-glow {
  animation: glow-pulse 3s ease-in-out infinite;
}
</style>
