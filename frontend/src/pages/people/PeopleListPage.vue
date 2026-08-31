<script setup lang="ts">
import { ref, computed } from 'vue';
import { AppHeader } from '@/widgets/header';
import {
  UIcon,
  UInput,
  EmptyState,
  SwipeableItem,
  ConfirmDeleteModal,
  InitialAvatar,
  Skeleton,
  useToast,
} from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useExchangeRates } from '@/shared/api';
import { usePeople, personKey, type Person } from '@/entities/person';
import { useDebts, foldDebtsIntoPeople } from '@/entities/debt';
import { listTransition } from '@/shared/lib/transitions';
import { colorForName } from '@/shared/config/colors';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import PersonEditSheet from './ui/PersonEditSheet.vue';

const { trigger } = useHaptics();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();
const { people, isLoading, createPerson, updatePerson, deletePerson } = usePeople(userId);
const { debts } = useDebts(userId, { status: 'active' });
const { convert } = useExchangeRates(currency);
const { toast } = useToast();

const query = ref('');
const editingPerson = ref<Person | null>(null);
const isSheetOpen = ref(false);
const isSaving = ref(false);
const personToDelete = ref<Person | null>(null);

/**
 * Долги хранят имя человека строкой, без person_id, поэтому нетто ищется по
 * нормализованному имени — тем же ключом, что и на странице долгов.
 */
const debtNetByPerson = computed(
  () => new Map(foldDebtsIntoPeople(debts.value, convert).map((p) => [p.key, p])),
);

function netFor(person: Person) {
  return debtNetByPerson.value.get(personKey(person.name));
}

const sortedPeople = computed(() =>
  [...people.value].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
);

const filteredPeople = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return sortedPeople.value;
  return sortedPeople.value.filter((p) => p.name.toLowerCase().includes(q));
});

/**
 * Кнопка создания появляется только когда точного совпадения нет: иначе она
 * предлагала бы завести второго человека с уже занятым именем, а долги
 * связываются с контактом именно по имени.
 */
const canCreate = computed(() => {
  const name = query.value.trim();
  if (!name) return false;
  return !people.value.some((p) => p.name.trim().toLowerCase() === name.toLowerCase());
});

/** Сумма того, что должны вам; встречные долги уже свёрнуты в нетто по человеку. */
const owedToUser = computed(() => {
  let total = 0;
  for (const person of people.value) {
    const net = netFor(person);
    if (net && net.net > 0) total += net.net;
  }
  return total;
});

const summaryText = computed(() => {
  const count = sortedPeople.value.length;
  const base = `${count} ${pluralize(count, 'контакт', 'контакта', 'контактов')}`;
  if (owedToUser.value <= 0) return base;
  return `${base} · вам должны ${formatCurrency(owedToUser.value, currency.value, COMPACT_FORMAT)}`;
});

async function handleCreate() {
  const name = query.value.trim();
  if (!name) return;

  trigger('selection');
  try {
    await createPerson({ name, color: colorForName(name) });
    query.value = '';
    toast({ title: 'Контакт добавлен', variant: 'success' });
  } catch {
    toast({ title: 'Не удалось добавить контакт', variant: 'error' });
  }
}

function openEdit(person: Person) {
  editingPerson.value = person;
  isSheetOpen.value = true;
  trigger('selection');
}

async function handleSave(payload: { name: string; color: string }) {
  if (!editingPerson.value) return;

  isSaving.value = true;
  try {
    await updatePerson(editingPerson.value.id, payload);
    isSheetOpen.value = false;
    toast({ title: 'Контакт обновлён', variant: 'success' });
  } catch {
    toast({ title: 'Не удалось сохранить', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}

function requestDelete(person: Person) {
  personToDelete.value = person;
  isSheetOpen.value = false;
}

async function handleDelete() {
  if (!personToDelete.value) return;
  try {
    await deletePerson(personToDelete.value.id);
    toast({ title: 'Контакт удалён', variant: 'success' });
  } catch {
    toast({ title: 'Не удалось удалить', variant: 'error' });
  } finally {
    personToDelete.value = null;
  }
}
</script>

<template>
  <div
    class="h-dvh flex flex-col relative bg-background-light dark:bg-background-dark overflow-hidden"
  >
    <AppHeader blur show-back title="Люди" @back="navigateBack()" />

    <main class="flex-1 overflow-y-auto px-4 pt-4 pb-32">
      <!-- Одно поле работает и фильтром, и вводом нового имени: добавление
           перестаёт быть отдельным маршрутом через кнопку и модалку. -->
      <UInput
        v-model="query"
        data-testid="person-search-input"
        variant="search"
        icon="search"
        placeholder="Поиск или новое имя"
        aria-label="Поиск контакта или имя нового"
        @keydown="(e: KeyboardEvent) => e.key === 'Enter' && canCreate && handleCreate()"
      />

      <Transition
        enter-active-class="transition-[opacity,transform] duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <button
          v-if="canCreate"
          type="button"
          data-testid="create-person-btn"
          class="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 transition-colors active:bg-primary/10"
          @click="handleCreate"
        >
          <span
            class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
          >
            <UIcon name="add" size="sm" class="text-primary" />
          </span>
          <span class="flex-1 min-w-0 truncate text-left text-body-sm font-medium text-primary">
            Добавить «{{ query.trim() }}»
          </span>
        </button>
      </Transition>

      <template v-if="isLoading">
        <div data-testid="people-loading" class="mt-4 mb-3">
          <Skeleton class="h-4 w-40 rounded" />
        </div>
        <div class="space-y-2">
          <div
            v-for="i in 6"
            :key="i"
            class="flex items-center gap-3 px-3 py-2 rounded-xl bg-card-light dark:bg-card-dark border border-border-light/50 dark:border-border-dark/50"
          >
            <Skeleton class="w-8 h-8 rounded-full shrink-0" />
            <Skeleton class="h-4 rounded flex-1" :style="{ maxWidth: `${90 + i * 18}px` }" />
          </div>
        </div>
      </template>

      <template v-else>
        <p
          v-if="sortedPeople.length > 0"
          data-testid="people-count"
          class="mt-4 mb-2 px-1 text-body-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ summaryText }}
        </p>

        <TransitionGroup
          v-if="filteredPeople.length > 0"
          v-bind="listTransition"
          tag="div"
          data-testid="people-list"
          class="space-y-2 relative"
        >
          <div v-for="person in filteredPeople" :key="person.id" data-testid="person-item">
            <SwipeableItem
              :left-action="{ icon: 'delete', color: '#ef4444', label: 'Удалить' }"
              :right-action="{ icon: 'edit', color: '#4f46e5', label: 'Править' }"
              @action-left="personToDelete = person"
              @action-right="openEdit(person)"
            >
              <button
                type="button"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-card-light dark:bg-card-dark border border-border-light/50 dark:border-border-dark/50 transition-colors active:bg-surface-light dark:active:bg-surface-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                @click="openEdit(person)"
              >
                <InitialAvatar :name="person.name" :color="person.color" size="md" />

                <span
                  class="flex-1 min-w-0 truncate text-left text-body font-medium text-text-primary-light dark:text-text-primary-dark"
                >
                  {{ person.name }}
                </span>

                <span v-if="netFor(person)?.net" class="shrink-0 text-right">
                  <span
                    class="block text-caption-sm leading-tight text-text-tertiary-light dark:text-text-tertiary-dark"
                  >
                    {{ netFor(person)!.net > 0 ? 'должен вам' : 'вы должны' }}
                  </span>
                  <span
                    class="block text-body-sm font-semibold tabular-nums leading-tight"
                    :class="netFor(person)!.net > 0 ? 'text-success' : 'text-danger'"
                  >
                    {{ formatCurrency(Math.abs(netFor(person)!.net), currency, COMPACT_FORMAT) }}
                  </span>
                </span>
              </button>
            </SwipeableItem>
          </div>
        </TransitionGroup>

        <div
          v-else-if="query.trim()"
          data-testid="people-no-matches"
          class="mt-10 text-center text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Ничего не нашлось. Нажмите «Добавить», чтобы завести контакт.
        </div>

        <div
          v-else
          data-testid="people-empty-state"
          class="h-[55vh] flex items-center justify-center"
        >
          <EmptyState
            icon="group"
            title="Нет контактов"
            description="Введите имя в поле сверху — контакт появится в списке и станет доступен при создании долгов и делении расходов"
            icon-bg-class="bg-primary/10 text-primary"
          />
        </div>
      </template>
    </main>

    <PersonEditSheet
      :open="isSheetOpen"
      :person="editingPerson"
      :debt-net="editingPerson ? netFor(editingPerson) : undefined"
      :currency="currency"
      :saving="isSaving"
      @update:open="isSheetOpen = $event"
      @save="handleSave"
      @delete="editingPerson && requestDelete(editingPerson)"
    />

    <ConfirmDeleteModal
      :model-value="!!personToDelete"
      title="Удалить контакт?"
      :warning-text="`Контакт «${personToDelete?.name}» будет удалён. Это действие нельзя отменить.`"
      @update:model-value="!$event && (personToDelete = null)"
      @confirm="handleDelete"
      @cancel="personToDelete = null"
    />
  </div>
</template>
