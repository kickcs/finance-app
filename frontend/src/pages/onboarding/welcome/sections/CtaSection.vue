<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { useAuth } from '@/shared/api/composables/useAuth';
import { SPRING_DEFAULT } from '../composables';

const router = useRouter();
const { signInAnonymously } = useAuth();

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
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-24"
    aria-label="Начать"
  >
    <!-- Ambient glows -->
    <div
      class="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/[0.08] blur-[180px]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute left-[10%] top-[20%] h-[300px] w-[300px] rounded-full bg-fuchsia-600/[0.05] blur-[120px]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute bottom-[20%] right-[10%] h-[300px] w-[300px] rounded-full bg-violet-600/[0.06] blur-[120px]"
      aria-hidden="true"
    />

    <div
      v-motion
      class="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto"
      :initial="{ opacity: 0, y: 50 }"
      :visible-once="{
        opacity: 1,
        y: 0,
        transition: SPRING_DEFAULT,
      }"
    >
      <h2 class="mb-5 text-4xl font-black sm:text-5xl lg:text-7xl">
        <span
          class="bg-gradient-to-r from-white via-indigo-100 to-violet-200 bg-clip-text text-transparent"
        >
          Готовы взять финансы
        </span>
        <br />
        <span
          class="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent filter drop-shadow-[0_0_20px_rgba(129,140,248,0.3)]"
        >
          под контроль?
        </span>
      </h2>
      <p
        v-motion
        class="mb-12 max-w-sm text-base text-white/50"
        :initial="{ opacity: 0, scale: 0.9 }"
        :visible-once="{
          opacity: 1,
          scale: 1,
          transition: { delay: 200, ...SPRING_DEFAULT },
        }"
      >
        Присоединяйтесь бесплатно. Никаких скрытых платежей или сложных подписок.
      </p>

      <div
        v-motion
        class="flex w-full max-w-xs flex-col gap-4"
        :initial="{ opacity: 0, y: 20 }"
        :visible-once="{
          opacity: 1,
          y: 0,
          transition: { delay: 400, ...SPRING_DEFAULT },
        }"
      >
        <button
          class="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 p-[1px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          @click="handleStart"
        >
          <span
            class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-60 blur-xl group-hover:opacity-100 transition-opacity duration-500"
          ></span>
          <div
            class="relative flex h-full w-full items-center justify-center rounded-2xl bg-black/50 px-8 py-4 backdrop-blur-sm transition-colors group-hover:bg-black/40"
          >
            <span class="text-[15px] font-bold text-white font-['Unbounded']">
              Начать бесплатно
            </span>
          </div>
        </button>
        <button
          class="glass-card gradient-border w-full rounded-2xl px-8 py-4 text-[13px] font-bold font-['Unbounded'] text-white/70 transition-colors hover:text-white disabled:opacity-40"
          :disabled="isDemoLoading"
          @click="handleDemo"
        >
          {{ isDemoLoading ? 'Загрузка...' : 'Попробовать демо' }}
        </button>
      </div>

      <p v-if="demoError" class="mt-4 text-xs text-rose-400 font-medium">{{ demoError }}</p>
      <p
        v-motion
        class="mt-8 text-[11px] font-bold uppercase tracking-[4px] text-white/20"
        :initial="{ opacity: 0 }"
        :visible-once="{ opacity: 1, transition: { delay: 600, duration: 800 } }"
      >
        Регистрация за 30 секунд · Без карт
      </p>
    </div>
  </section>
</template>
