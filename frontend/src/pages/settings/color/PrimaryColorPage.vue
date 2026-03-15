<script setup lang="ts">
import { computed } from 'vue';
import {
  ColorSwatchPickerRoot,
  ColorSwatchPickerItem,
  ColorSwatchPickerItemSwatch,
  ColorSwatchPickerItemIndicator,
} from 'reka-ui';
import { AppHeader } from '@/widgets/header';
import { PageContainer, UButton, UBadge, UProgressBar, UIcon, UCard } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { usePrimaryColor, PRIMARY_COLORS, COLOR_NAMES } from '@/features/select-primary-color';

const { colorName, setColor } = usePrimaryColor();

const selectedValue = computed({
  get: () => PRIMARY_COLORS[colorName.value]?.base ?? PRIMARY_COLORS.indigo.base,
  set: (hex: string) => {
    const name = COLOR_NAMES.find((n) => PRIMARY_COLORS[n].base === hex);
    if (name) setColor(name);
  },
});
</script>

<template>
  <PageContainer max-width="2xl" class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader title="Основной цвет" show-back @back="navigateBack" />
    </template>

    <main class="pt-8 pb-28 md:pb-8 space-y-6">
      <!-- Color Picker -->
      <UCard class="p-5" variant="bordered">
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-4 uppercase tracking-wider"
        >
          Выберите цвет
        </h2>

        <ColorSwatchPickerRoot
          v-model="selectedValue"
          class="grid grid-cols-6 gap-3 justify-items-center"
        >
          <ColorSwatchPickerItem
            v-for="name in COLOR_NAMES"
            :key="name"
            :value="PRIMARY_COLORS[name].base"
            class="relative w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <ColorSwatchPickerItemSwatch
              class="w-full h-full rounded-full"
              style="background-color: var(--reka-color-swatch-color)"
            />
            <ColorSwatchPickerItemIndicator
              class="absolute inset-0 flex items-center justify-center"
            >
              <UIcon name="check" size="sm" class="text-white drop-shadow-md" />
            </ColorSwatchPickerItemIndicator>
          </ColorSwatchPickerItem>
        </ColorSwatchPickerRoot>
      </UCard>

      <!-- Live Preview -->
      <UCard class="p-5" variant="bordered">
        <h2
          class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-4 uppercase tracking-wider"
        >
          Предпросмотр
        </h2>

        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <UButton variant="primary">Кнопка</UButton>
            <UButton variant="secondary">Вторичная</UButton>
          </div>

          <div class="flex items-center gap-2">
            <UBadge variant="primary">Бейдж</UBadge>
            <UBadge variant="success">Успех</UBadge>
          </div>

          <div>
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
              Прогресс
            </p>
            <UProgressBar :value="65" size="md" />
          </div>
        </div>
      </UCard>
    </main>
  </PageContainer>
</template>
