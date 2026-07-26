<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UButton, UIcon, UInput, UColorPicker, InitialAvatar } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import type { Person, PersonDebtNet } from '@/entities/person';

const props = defineProps<{
  open: boolean;
  person: Person | null;
  debtNet?: PersonDebtNet;
  currency: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [payload: { name: string; color: string }];
  delete: [];
}>();

const isDesktop = useIsDesktop();

const name = ref('');
const color = ref<string>(ENTITY_COLORS[0]);

// Синхронизируемся и на открытии, и на смене контакта — иначе при переходе с
// одного человека на другого в поле оставалось прежнее имя. Пустой person
// игнорируем: на закрытии он обнуляется, и форма схлопнулась бы на глазах.
watch(
  () => [props.open, props.person?.id] as const,
  ([isOpen]) => {
    if (!isOpen || !props.person) return;
    name.value = props.person.name;
    color.value = props.person.color;
  },
  { immediate: true },
);

const canSave = computed(() => name.value.trim().length > 0);

const debtLabel = computed(() => {
  const net = props.debtNet;
  if (!net || net.net === 0) return null;
  const count = `${net.debtCount} ${pluralize(net.debtCount, 'долг', 'долга', 'долгов')}`;
  const direction = net.net > 0 ? 'вам должны' : 'вы должны';
  const sum = formatCurrency(Math.abs(net.net), props.currency, COMPACT_FORMAT);
  return { count, direction, sum, positive: net.net > 0 };
});

function handleSave() {
  if (!canSave.value) return;
  emit('save', { name: name.value.trim(), color: color.value });
}
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        data-testid="person-edit-sheet"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-3 flex items-center gap-3" :class="{ 'pt-4': isDesktop }">
          <InitialAvatar :name="name || '?'" :color="color" size="md" class="shrink-0" />
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ person?.name || 'Контакт' }}
          </DrawerTitle>
        </div>

        <div class="px-5 pb-4 space-y-4 overflow-y-auto">
          <UInput
            v-model="name"
            data-testid="person-name-input"
            label="Имя"
            placeholder="Например: Аня, Коля…"
            @keydown="(e: KeyboardEvent) => e.key === 'Enter' && handleSave()"
          />

          <UColorPicker v-model="color" :colors="ENTITY_COLORS" label="Цвет аватара" />

          <RouterLink
            v-if="debtLabel"
            to="/debts"
            data-testid="person-debts-link"
            class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark transition-colors"
          >
            <span
              class="flex-1 min-w-0 text-body-sm text-text-secondary-light dark:text-text-secondary-dark truncate"
            >
              {{ debtLabel.count }} · {{ debtLabel.direction }}
            </span>
            <span
              class="shrink-0 text-body-sm font-semibold tabular-nums"
              :class="debtLabel.positive ? 'text-success' : 'text-danger'"
            >
              {{ debtLabel.sum }}
            </span>
            <UIcon
              name="chevron_right"
              size="sm"
              class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </RouterLink>
        </div>

        <div
          class="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2 border-t border-border-light dark:border-border-dark"
        >
          <UButton
            data-testid="delete-person-btn"
            variant="secondary"
            size="lg"
            class="shrink-0 text-danger"
            aria-label="Удалить контакт"
            @click="emit('delete')"
          >
            <UIcon name="delete" size="sm" />
          </UButton>
          <UButton
            data-testid="save-person-btn"
            variant="primary"
            size="lg"
            class="flex-1"
            :loading="saving"
            :disabled="!canSave"
            @click="handleSave"
          >
            Сохранить
          </UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
