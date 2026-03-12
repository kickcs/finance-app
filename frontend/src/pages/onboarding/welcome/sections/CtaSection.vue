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
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #0f0a2e 0%, #1e1b4b 50%, #0f0a2e 100%)"
  >
    <div
      class="flex flex-col items-center text-center transition-all duration-700"
      :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
    >
      <h2 class="mb-2 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
        Готовы взять финансы
        <br />
        под контроль?
      </h2>
      <p class="mb-7 max-w-sm text-sm text-white/50">
        Присоединяйтесь бесплатно. Никаких скрытых платежей.
      </p>

      <div class="flex w-64 flex-col gap-2.5">
        <button
          class="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-shadow hover:shadow-xl hover:shadow-indigo-500/40"
          @click="handleStart"
        >
          Начать бесплатно
        </button>
        <button
          class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-8 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          :disabled="isDemoLoading"
          @click="handleDemo"
        >
          {{ isDemoLoading ? 'Загрузка...' : 'Попробовать демо' }}
        </button>
      </div>

      <p v-if="demoError" class="mt-3 text-xs text-red-400">{{ demoError }}</p>
      <p class="mt-4 text-[10px] text-white/25">Регистрация за 30 секунд • Без привязки карты</p>
    </div>
  </section>
</template>
