<script setup lang="ts">
import { computed, useId, ref, watch } from 'vue';
import { cn } from '@/shared/lib/utils';
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { UIcon } from '@/shared/ui';

export interface InputProps {
  modelValue?: string | number;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date';
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  variant?: 'default' | 'search' | 'currency';
  icon?: string;
  suffix?: string;
  size?: 'md' | 'lg';
  id?: string;
  min?: string;
  max?: string;
  showPasswordToggle?: boolean;
}

const props = withDefaults(defineProps<InputProps>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  variant: 'default',
  size: 'md',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  clear: [];
  keydown: [event: KeyboardEvent];
}>();

const generatedId = useId();
const inputId = computed(() => props.id || generatedId);

// Password visibility state
const isPasswordVisible = ref(false);

function togglePasswordVisibility() {
  isPasswordVisible.value = !isPasswordVisible.value;
}

// Shake animation state
const isShaking = ref(false);

// Trigger shake animation when error appears
watch(
  () => props.error,
  (newError, oldError) => {
    if (newError && !oldError) {
      isShaking.value = true;
      setTimeout(() => {
        isShaking.value = false;
      }, 400);
    }
  },
);

const inputValue = computed({
  get: () => {
    if (props.variant === 'currency') {
      const value = props.modelValue;
      if (!value && value !== 0) return '';
      return formatNumberWithSpaces(value);
    }
    return props.modelValue;
  },
  set: (value) => {
    if (props.variant === 'currency') {
      const cleaned = String(value).replace(/,/g, '.').replace(/[^\d.]/g, '');
      const parts = cleaned.split('.');
      const sanitized =
        parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
      emit('update:modelValue', sanitized);
    } else {
      emit('update:modelValue', value);
    }
  },
});

const inputType = computed(() => {
  if (props.variant === 'currency') return 'text';
  if (
    props.type === 'password' &&
    props.showPasswordToggle &&
    isPasswordVisible.value
  ) {
    return 'text';
  }
  return props.type;
});

const inputMode = computed(() => {
  if (props.variant === 'currency') return 'decimal';
  return undefined;
});
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full">
    <!-- Label -->
    <label
      v-if="label"
      :for="inputId"
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark ml-0.5"
    >
      {{ label }}
    </label>

    <!-- Input wrapper -->
    <div
      :class="
        cn(
          'relative flex items-center w-full rounded-lg transition-all duration-150 overflow-hidden',
          'bg-card-light dark:bg-card-dark',
          'border border-border-light dark:border-border-dark',
          'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20',
          variant === 'search' &&
            'bg-surface-light dark:bg-surface-dark border-transparent',
          error &&
            'border-danger focus-within:border-danger focus-within:ring-danger/20',
          disabled && 'opacity-50 pointer-events-none',
          isShaking && 'animate-shake',
        )
      "
    >
      <!-- Icon prefix -->
      <UIcon
        v-if="icon || variant === 'search'"
        :name="icon || 'search'"
        size="lg"
        class="text-text-tertiary-light dark:text-text-tertiary-dark pl-3"
      />

      <!-- Input -->
      <input
        :id="inputId"
        v-model="inputValue"
        :type="inputType"
        :inputmode="inputMode"
        :placeholder="placeholder"
        :disabled="disabled"
        :min="min"
        :max="max"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        :class="
          cn(
            'bg-transparent border-none outline-none w-full',
            'text-text-primary-light dark:text-text-primary-dark',
            'placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark',
            size === 'lg' ? 'py-3.5' : 'py-3',
            icon || variant === 'search' ? 'pl-2' : 'pl-3',
            suffix || variant === 'currency' ? 'pr-2' : 'pr-3',
            variant === 'currency' && 'text-2xl font-semibold min-w-0 flex-1',
            variant !== 'currency' && 'flex-1 min-w-0 text-sm',
          )
        "
        @keydown="$emit('keydown', $event)"
      />

      <!-- Suffix -->
      <span
        v-if="suffix || variant === 'currency'"
        :class="
          cn(
            'text-text-secondary-light dark:text-text-secondary-dark pr-3 font-medium whitespace-nowrap flex-shrink-0',
            variant === 'currency' && 'text-lg',
          )
        "
      >
        {{ suffix }}
      </span>

      <!-- Password toggle button -->
      <button
        v-if="type === 'password' && showPasswordToggle"
        type="button"
        tabindex="-1"
        class="flex items-center justify-center pr-3 text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors"
        @click="togglePasswordVisibility"
      >
        <UIcon
          :name="isPasswordVisible ? 'visibility_off' : 'visibility'"
          size="sm"
        />
      </button>

      <!-- Error icon -->
      <span
        v-if="
          error &&
          variant !== 'currency' &&
          !(type === 'password' && showPasswordToggle)
        "
        class="absolute right-3 text-danger"
      >
        <UIcon name="error" size="sm" />
      </span>
    </div>

    <!-- Error message -->
    <Transition name="slide-fade">
      <span
        v-if="error"
        :id="`${inputId}-error`"
        class="text-xs text-danger ml-0.5 flex items-center gap-1"
        role="alert"
      >
        {{ error }}
      </span>
    </Transition>
  </div>
</template>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.15s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.1s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
