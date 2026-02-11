<script setup lang="ts">
export interface IconProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  filled?: boolean
  color?: string
  ariaLabel?: string
}

withDefaults(defineProps<IconProps>(), {
  size: 'md',
  filled: false,
})

const fontVariationFilled = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
const fontVariationOutlined = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
</script>

<template>
  <span
    :class="[
      'material-symbols-outlined inline-flex items-center justify-center select-none',
      {
        'text-xs': size === 'xs',
        'text-sm': size === 'sm',
        'text-base': size === 'md',
        'text-xl': size === 'lg',
        'text-2xl': size === 'xl',
        'text-3xl': size === '2xl',
      },
      color,
    ]"
    :style="{
      fontVariationSettings: filled ? fontVariationFilled : fontVariationOutlined,
    }"
    :aria-hidden="!ariaLabel"
    :aria-label="ariaLabel"
    :role="ariaLabel ? 'img' : undefined"
  >
    {{ name }}
  </span>
</template>
