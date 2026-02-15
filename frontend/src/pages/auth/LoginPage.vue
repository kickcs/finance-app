<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { UButton, UInput, UCard, UIcon } from '@/shared/ui'
import { useAuth } from '@/shared/api/composables/useAuth'
import { profileApi } from '@/shared/api/services/profileApi'

const router = useRouter()
const { signIn, signUp, signInWithOAuth, signInAnonymously, isLoading, error } = useAuth()

const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const localError = ref<string | null>(null)

// Email verification state
const showEmailVerification = ref(false)
const verificationEmail = ref('')

// Validation state
const emailError = ref<string | undefined>(undefined)
const passwordError = ref<string | undefined>(undefined)
const confirmPasswordError = ref<string | undefined>(undefined)

// Validation constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

// Validation functions
function validateEmail(): boolean {
  if (!email.value.trim()) {
    emailError.value = 'Email обязателен'
    return false
  }
  if (!EMAIL_REGEX.test(email.value)) {
    emailError.value = 'Введите корректный email'
    return false
  }
  emailError.value = undefined
  return true
}

function validatePassword(): boolean {
  if (!password.value) {
    passwordError.value = 'Пароль обязателен'
    return false
  }
  if (isSignUp.value && password.value.length < MIN_PASSWORD_LENGTH) {
    passwordError.value = `Минимум ${MIN_PASSWORD_LENGTH} символов`
    return false
  }
  passwordError.value = undefined
  return true
}

function validateConfirmPassword(): boolean {
  if (!isSignUp.value) {
    confirmPasswordError.value = undefined
    return true
  }
  if (!confirmPassword.value) {
    confirmPasswordError.value = 'Подтвердите пароль'
    return false
  }
  if (confirmPassword.value !== password.value) {
    confirmPasswordError.value = 'Пароли не совпадают'
    return false
  }
  confirmPasswordError.value = undefined
  return true
}

function validateForm(): boolean {
  const isEmailValid = validateEmail()
  const isPasswordValid = validatePassword()
  const isConfirmPasswordValid = validateConfirmPassword()
  return isEmailValid && isPasswordValid && isConfirmPasswordValid
}

// Clear errors on input
watch(email, () => {
  if (emailError.value) validateEmail()
})

watch(password, () => {
  if (passwordError.value) validatePassword()
  // Also revalidate confirm password if it was already validated
  if (confirmPasswordError.value && confirmPassword.value) {
    validateConfirmPassword()
  }
})

watch(confirmPassword, () => {
  if (confirmPasswordError.value) validateConfirmPassword()
})

// Clear confirm password when switching modes
watch(isSignUp, () => {
  confirmPassword.value = ''
  confirmPasswordError.value = undefined
})

async function handleSubmit() {
  // Validate before submission
  if (!validateForm()) {
    return
  }

  try {
    localError.value = null

    if (isSignUp.value) {
      const data = await signUp(email.value, password.value)

      // With NestJS backend, registration returns user directly
      if (data.user) {
        // Navigate to onboarding
        router.push({ name: 'first-account' })
      }
    } else {
      const data = await signIn(email.value, password.value)

      // Проверить, завершил ли пользователь onboarding
      if (data.user) {
        const profile = await profileApi.getById(data.user.id)

        if (profile?.has_completed_onboarding) {
          // Синхронизируем localStorage
          localStorage.setItem('onboardingComplete', 'true')
          if (profile.currency) {
            localStorage.setItem('selectedCurrency', profile.currency)
          }
          router.push({ name: 'dashboard' })
        } else {
          // Не завершил onboarding - отправляем на создание первого счёта
          router.push({ name: 'first-account' })
        }
      }
    }
  } catch (err: unknown) {
    // Логируем для отладки
    console.error('Auth error:', err)

    const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка'

    // Обработка ошибки "email уже зарегистрирован"
    if (errorMessage.toLowerCase().includes('already registered') ||
        errorMessage.toLowerCase().includes('already exists') ||
        errorMessage.toLowerCase().includes('user already')) {
      localError.value = 'Этот email уже зарегистрирован. Попробуйте войти.'
    } else if (errorMessage.toLowerCase().includes('invalid login') ||
               errorMessage.toLowerCase().includes('invalid credentials') ||
               errorMessage.toLowerCase().includes('unauthorized')) {
      localError.value = 'Неверный email или пароль'
    } else if (errorMessage.toLowerCase().includes('email not confirmed')) {
      localError.value = 'Email не подтверждён. Проверьте почту.'
    } else {
      localError.value = errorMessage
    }
  }
}

async function handleOAuth(provider: 'google' | 'github') {
  try {
    isOAuthLoading.value = true
    localError.value = null
    await signInWithOAuth(provider)
  } catch (err: unknown) {
    localError.value = err instanceof Error ? err.message : 'Произошла ошибка'
  } finally {
    isOAuthLoading.value = false
  }
}

function backToLogin() {
  showEmailVerification.value = false
  verificationEmail.value = ''
}

// Demo mode
const isDemoLoading = ref(false)

// OAuth loading state
const isOAuthLoading = ref(false)

// Combined loading state - blocks all buttons when any action is in progress
const isAnyLoading = computed(() => isLoading.value || isDemoLoading.value || isOAuthLoading.value)

async function handleDemoMode() {
  try {
    isDemoLoading.value = true
    localError.value = null

    const { user } = await signInAnonymously()

    if (user) {
      // Demo data is now initialized on the backend automatically
      // Just set localStorage flags and navigate to dashboard
      localStorage.setItem('onboardingComplete', 'true')
      localStorage.setItem('selectedCurrency', 'UZS')

      // Navigate directly to dashboard
      router.push({ name: 'dashboard' })
    }
  } catch (err) {
    console.error('Demo mode error:', err)
    // Check for rate limiting error
    if (err instanceof Error && err.message.includes('429')) {
      localError.value = 'Слишком много запросов. Попробуйте позже.'
    } else {
      localError.value = 'Не удалось запустить демо режим'
    }
  } finally {
    isDemoLoading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 bg-background-light dark:bg-background-dark"
  >
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-primary mb-2">Ouro</h1>
        <p class="text-text-secondary-light dark:text-text-secondary-dark">
          {{ isSignUp ? 'Создайте аккаунт' : 'Войдите в аккаунт' }}
        </p>
      </div>

      <!-- Email Verification Message -->
      <UCard v-if="showEmailVerification" class="p-6 text-center">
        <div
          class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
        >
          <UIcon name="mark_email_read" size="2xl" class="text-primary" />
        </div>
        <h2
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2"
        >
          Проверьте почту
        </h2>
        <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
          Мы отправили письмо на
          <strong class="text-text-primary-light dark:text-text-primary-dark">{{
            verificationEmail
          }}</strong
          >. Перейдите по ссылке для подтверждения аккаунта.
        </p>
        <UButton variant="ghost" @click="backToLogin"> Вернуться к входу </UButton>
      </UCard>

      <!-- Auth Form -->
      <UCard v-else class="p-6">
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <UInput
            v-model="email"
            type="email"
            label="Email"
            placeholder="your@email.com"
            autocomplete="email"
            :error="emailError"
            @blur="validateEmail"
          />

          <UInput
            v-model="password"
            type="password"
            label="Пароль"
            placeholder="••••••••"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            :error="passwordError"
            show-password-toggle
            @blur="validatePassword"
          />

          <!-- Confirm password (only for sign up) -->
          <UInput
            v-if="isSignUp"
            v-model="confirmPassword"
            type="password"
            label="Подтвердите пароль"
            placeholder="••••••••"
            autocomplete="new-password"
            :error="confirmPasswordError"
            show-password-toggle
            @blur="validateConfirmPassword"
          />

          <!-- Error message -->
          <p v-if="localError" class="text-sm text-danger">
            {{ localError }}
          </p>

          <UButton type="submit" variant="primary" size="lg" full-width :loading="isLoading" :disabled="isAnyLoading && !isLoading">
            {{ isSignUp ? 'Создать аккаунт' : 'Войти' }}
          </UButton>
        </form>

        <!-- Divider -->
        <div class="flex items-center gap-4 my-6">
          <div class="flex-1 h-px bg-border-light dark:bg-border-dark" />
          <span class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">или</span>
          <div class="flex-1 h-px bg-border-light dark:bg-border-dark" />
        </div>

        <!-- OAuth Buttons (disabled for now - not implemented in NestJS) -->
        <div class="space-y-3">
          <UButton variant="secondary" size="lg" full-width :disabled="true" @click="handleOAuth('google')">
            <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Войти через Google
          </UButton>

          <UButton variant="secondary" size="lg" full-width :disabled="true" @click="handleOAuth('github')">
            <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
              />
            </svg>
            Войти через GitHub
          </UButton>
        </div>

        <!-- Demo Mode -->
        <div class="mt-4">
          <div class="flex items-center gap-4 my-4">
            <div class="flex-1 h-px bg-border-light dark:bg-border-dark" />
            <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              или попробуйте
            </span>
            <div class="flex-1 h-px bg-border-light dark:bg-border-dark" />
          </div>

          <UButton
            variant="secondary"
            size="lg"
            full-width
            :loading="isDemoLoading"
            :disabled="isAnyLoading && !isDemoLoading"
            @click="handleDemoMode"
          >
            <UIcon v-if="!isDemoLoading" name="play_circle" class="mr-2" />
            {{ isDemoLoading ? 'Создание демо аккаунта...' : 'Попробовать демо' }}
          </UButton>

          <p class="text-xs text-center text-text-tertiary-light dark:text-text-tertiary-dark mt-2">
            Демо аккаунт с тестовыми данными (1 час)
          </p>
        </div>

        <!-- Toggle Sign Up / Sign In -->
        <p class="text-center text-sm mt-6 text-text-secondary-light dark:text-text-secondary-dark">
          {{ isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?' }}
          <button type="button" class="text-primary font-medium ml-1" @click="isSignUp = !isSignUp">
            {{ isSignUp ? 'Войти' : 'Создать' }}
          </button>
        </p>
      </UCard>
    </div>
  </div>
</template>
