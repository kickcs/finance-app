<script setup lang="ts">
import { UIcon, UButton } from '@/shared/ui'

defineProps<{
  title?: string
  showBack?: boolean
  showNotifications?: boolean
  transparent?: boolean
  notificationCount?: number
}>()

defineEmits<{
  back: []
  notifications: []
}>()
</script>

<template>
  <header
    :class="[
      'sticky top-0 z-30 px-5 py-3',
      'transition-colors duration-150',
      transparent
        ? 'bg-transparent'
        : 'bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark'
    ]"
    :style="{ paddingTop: 'calc(0.75rem + var(--safe-area-inset-top))' }"
  >
    <div class="flex items-center justify-between">
      <!-- Left side -->
      <div class="flex items-center gap-3">
        <UButton
          v-if="showBack"
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Назад"
          @click="$emit('back')"
        >
          <UIcon name="arrow_back" size="sm" />
        </UButton>

        <!-- Left slot -->
        <slot name="left" />

        <h1
          v-if="title"
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ title }}
        </h1>

        <!-- Logo slot -->
        <slot name="logo" />
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-1">
        <slot name="actions" />

        <!-- Notification button -->
        <div v-if="showNotifications" class="relative">
          <UButton
            variant="ghost"
            size="sm"
            class="!p-2"
            aria-label="Уведомления"
            @click="$emit('notifications')"
          >
            <UIcon name="notifications" size="sm" />
          </UButton>

          <!-- Notification badge -->
          <span
            v-if="notificationCount && notificationCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1
                   bg-danger text-white text-[9px] font-semibold
                   rounded-full flex items-center justify-center
                   border-2 border-background-light dark:border-background-dark"
          >
            {{ notificationCount > 9 ? '9+' : notificationCount }}
          </span>
        </div>
      </div>
    </div>
  </header>
</template>
