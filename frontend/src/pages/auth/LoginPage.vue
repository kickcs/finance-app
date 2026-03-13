<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UInput, UIcon } from '@/shared/ui';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useAuth } from '@/shared/api/composables/useAuth';
import { DemoSetupScreen } from '@/features/demo-mode';
import { profileApi } from '@/shared/api/services/profileApi';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { DEFAULT_CURRENCY } from '@/entities/currency/model/constants';

const router = useRouter();
const route = useRoute();
const { signIn, signUp, isLoading, error: _error } = useAuth();

const isSignUp = ref(false);

// Auto-switch to register form when coming from landing CTA
watch(
  () => route.query.mode,
  (mode) => {
    if (mode === 'register') {
      isSignUp.value = true;
    }
  },
  { immediate: true },
);
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const localError = ref<string | null>(null);

// Email verification state
const showEmailVerification = ref(false);
const verificationEmail = ref('');

// Validation state
const emailError = ref<string | undefined>(undefined);
const passwordError = ref<string | undefined>(undefined);
const confirmPasswordError = ref<string | undefined>(undefined);

// Validation constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// Validation functions
function validateEmail(): boolean {
  if (!email.value.trim()) {
    emailError.value = 'Email обязателен';
    return false;
  }
  if (!EMAIL_REGEX.test(email.value)) {
    emailError.value = 'Введите корректный email';
    return false;
  }
  emailError.value = undefined;
  return true;
}

function validatePassword(): boolean {
  if (!password.value) {
    passwordError.value = 'Пароль обязателен';
    return false;
  }
  if (isSignUp.value && password.value.length < MIN_PASSWORD_LENGTH) {
    passwordError.value = `Минимум ${MIN_PASSWORD_LENGTH} символов`;
    return false;
  }
  passwordError.value = undefined;
  return true;
}

function validateConfirmPassword(): boolean {
  if (!isSignUp.value) {
    confirmPasswordError.value = undefined;
    return true;
  }
  if (!confirmPassword.value) {
    confirmPasswordError.value = 'Подтвердите пароль';
    return false;
  }
  if (confirmPassword.value !== password.value) {
    confirmPasswordError.value = 'Пароли не совпадают';
    return false;
  }
  confirmPasswordError.value = undefined;
  return true;
}

function validateForm(): boolean {
  const isEmailValid = validateEmail();
  const isPasswordValid = validatePassword();
  const isConfirmPasswordValid = validateConfirmPassword();
  return isEmailValid && isPasswordValid && isConfirmPasswordValid;
}

// Clear errors on input
watch(email, () => {
  if (emailError.value) validateEmail();
});

watch(password, () => {
  if (passwordError.value) validatePassword();
  // Also revalidate confirm password if it was already validated
  if (confirmPasswordError.value && confirmPassword.value) {
    validateConfirmPassword();
  }
});

watch(confirmPassword, () => {
  if (confirmPasswordError.value) validateConfirmPassword();
});

// Clear confirm password when switching modes
watch(isSignUp, () => {
  confirmPassword.value = '';
  confirmPasswordError.value = undefined;
});

async function handleSubmit() {
  // Validate before submission
  if (!validateForm()) {
    return;
  }

  try {
    localError.value = null;

    if (isSignUp.value) {
      const data = await signUp(email.value, password.value);

      // With NestJS backend, registration returns user directly
      if (data.user) {
        // Navigate to onboarding
        router.push({ name: ROUTE_NAMES.FIRST_ACCOUNT });
      }
    } else {
      const data = await signIn(email.value, password.value);

      // Проверить, завершил ли пользователь onboarding
      if (data.user) {
        const profile = await profileApi.getById(data.user.id);

        if (profile?.has_completed_onboarding) {
          // Синхронизируем localStorage
          localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
          if (profile.currency) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, profile.currency);
          }
          router.push({ name: ROUTE_NAMES.DASHBOARD });
        } else {
          // Не завершил onboarding - отправляем на создание первого счёта
          router.push({ name: ROUTE_NAMES.FIRST_ACCOUNT });
        }
      }
    }
  } catch (err: unknown) {
    // Логируем для отладки
    console.error('Auth error:', err);

    const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка';

    // Обработка ошибки "email уже зарегистрирован"
    if (
      errorMessage.toLowerCase().includes('already registered') ||
      errorMessage.toLowerCase().includes('already exists') ||
      errorMessage.toLowerCase().includes('user already')
    ) {
      localError.value = 'Этот email уже зарегистрирован. Попробуйте войти.';
    } else if (
      errorMessage.toLowerCase().includes('invalid login') ||
      errorMessage.toLowerCase().includes('invalid credentials') ||
      errorMessage.toLowerCase().includes('unauthorized')
    ) {
      localError.value = 'Неверный email или пароль';
    } else if (errorMessage.toLowerCase().includes('email not confirmed')) {
      localError.value = 'Email не подтверждён. Проверьте почту.';
    } else {
      localError.value = errorMessage;
    }
  }
}

function backToLogin() {
  showEmailVerification.value = false;
  verificationEmail.value = '';
}

// Demo mode
const showDemoSetup = ref(false);

// Combined loading state - blocks all buttons when any action is in progress
const isAnyLoading = computed(() => isLoading.value || showDemoSetup.value);

function handleDemoMode() {
  if (showDemoSetup.value) return;
  localError.value = null;
  showDemoSetup.value = true;
}

function onDemoComplete() {
  showDemoSetup.value = false;
  localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
  localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, DEFAULT_CURRENCY);
  router.push({ name: ROUTE_NAMES.DASHBOARD });
}

function onDemoError(error: string) {
  showDemoSetup.value = false;
  localError.value = error;
}
</script>

<template>
  <div
    class="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8 bg-background-light dark:bg-background-dark relative overflow-hidden"
  >
    <!-- Background glow effects -->
    <div class="fixed inset-0 pointer-events-none -z-0 overflow-hidden">
      <div
        class="absolute -top-[10%] -right-[5%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px]"
      />
      <div
        class="absolute -bottom-[10%] -left-[10%] w-[250px] h-[250px] bg-primary/5 rounded-full blur-[60px]"
      />
    </div>

    <div class="w-full max-w-[420px] flex flex-col relative z-10">
      <!-- Email Verification Message -->
      <template v-if="showEmailVerification">
        <div class="flex flex-col items-center text-center">
          <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <UIcon name="mark_email_read" size="2xl" class="text-primary" />
          </div>
          <h2
            class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2"
          >
            Проверьте почту
          </h2>
          <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
            Мы отправили письмо на
            <strong class="text-text-primary-light dark:text-text-primary-dark">
              {{ verificationEmail }}
            </strong>
            . Перейдите по ссылке для подтверждения аккаунта.
          </p>
          <UButton variant="ghost" @click="backToLogin">Вернуться к входу</UButton>
        </div>
      </template>

      <!-- Auth Form -->
      <template v-else>
        <!-- Logo & Title -->
        <div class="flex flex-col items-center justify-center mb-10">
          <h1 class="text-primary text-5xl font-extrabold tracking-tight mb-3">Ouro</h1>
          <h2
            class="text-text-primary-light dark:text-text-primary-dark text-xl font-bold leading-tight tracking-[-0.015em] text-center opacity-90"
          >
            {{ isSignUp ? 'Создайте аккаунт' : 'Войдите в аккаунт' }}
          </h2>
        </div>

        <div class="flex flex-col gap-5 w-full">
          <!-- Form fields -->
          <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
            <UInput
              v-model="email"
              type="email"
              placeholder="Email"
              autocomplete="email"
              icon="mail"
              size="lg"
              :error="emailError"
              @blur="validateEmail"
            />

            <UInput
              v-model="password"
              type="password"
              placeholder="Пароль"
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
              icon="lock"
              size="lg"
              :error="passwordError"
              show-password-toggle
              @blur="validatePassword"
            />

            <!-- Confirm password (only for sign up) -->
            <UInput
              v-if="isSignUp"
              v-model="confirmPassword"
              type="password"
              placeholder="Подтвердите пароль"
              autocomplete="new-password"
              icon="lock"
              size="lg"
              :error="confirmPasswordError"
              show-password-toggle
              @blur="validateConfirmPassword"
            />

            <!-- Error message -->
            <p v-if="localError" class="text-sm text-danger">
              {{ localError }}
            </p>

            <!-- Submit button -->
            <UButton
              type="submit"
              variant="primary"
              size="xl"
              full-width
              :loading="isLoading"
              :disabled="isAnyLoading && !isLoading"
              class="!h-14 !rounded-xl !text-lg !font-bold !shadow-lg !shadow-primary/20 mt-2"
            >
              {{ isSignUp ? 'Создать аккаунт' : 'Войти' }}
            </UButton>
          </form>

          <!-- Sign Up / Sign In toggle card -->
          <div
            v-if="!isSignUp"
            class="p-4 rounded-2xl bg-card-light dark:bg-surface-dark border border-border-light dark:border-border-dark/50 shadow-xs"
          >
            <div class="flex flex-col items-center text-center gap-3">
              <div>
                <h3 class="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                  Впервые здесь?
                </h3>
                <p
                  class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1 leading-relaxed"
                >
                  Создайте учётную запись, чтобы начать отслеживать свои финансы.
                </p>
              </div>
              <button
                type="button"
                class="w-full h-10 rounded-lg bg-text-primary-light dark:bg-text-primary-dark text-text-primary-dark dark:text-text-primary-light font-bold text-sm hover:opacity-90 transition-opacity"
                @click="isSignUp = true"
              >
                Создать аккаунт
              </button>
            </div>
          </div>

          <!-- Back to login (when in sign up mode) -->
          <p
            v-else
            class="text-center text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
            Уже есть аккаунт?
            <button type="button" class="text-primary font-semibold ml-1" @click="isSignUp = false">
              Войти
            </button>
          </p>

          <!-- Demo divider -->
          <div class="flex items-center justify-center my-1">
            <span
              class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest"
            >
              или попробуйте
            </span>
          </div>

          <!-- Demo Mode Button -->
          <div class="flex flex-col gap-2">
            <button
              :disabled="isAnyLoading"
              class="group w-full flex items-center justify-between px-4 h-14 rounded-xl border border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
              @click="handleDemoMode"
            >
              <span class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300"
                >
                  <UIcon name="play_arrow" size="sm" />
                </div>
                <span
                  class="text-text-primary-light dark:text-text-primary-dark font-bold text-base"
                >
                  Попробовать демо
                </span>
              </span>
              <UIcon
                name="arrow_forward"
                size="sm"
                class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-primary transition-colors"
              />
            </button>
            <p
              class="text-center text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-medium"
            >
              Доступ ко всем функциям на 1 час
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- Demo Setup Overlay -->
    <DemoSetupScreen :visible="showDemoSetup" @complete="onDemoComplete" @error="onDemoError" />
  </div>
</template>
