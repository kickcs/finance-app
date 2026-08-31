<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UButton, UIcon, UInput, InitialAvatar } from '@/shared/ui';
import { UOverlay } from '@/shared/ui/overlay';
import { cn } from '@/shared/lib/utils';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import { useIsDesktop } from '@/shared/lib/platform';
import { usePeople, personKey } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import type { Participant } from '../model/types';

/**
 * Выбор участников чека: шторка на телефоне, правая панель на компьютере.
 *
 * Раньше это была центрированная `UModal` с двумя разными списками — чипы
 * контактов (обрезанные `slice(0, 8)`, без поиска: остальных людей просто не
 * существовало) и отдельный список уже добавленных. Человека приходилось
 * искать глазами в одном списке, тапать «добавить» и потом искать его же во
 * втором. Здесь список один: все контакты целиком, с поиском, и тап по строке
 * переключает участие — состояние видно сразу по подсветке и галочке.
 *
 * Ручной ввод имени тоже растворился в поиске: если совпадений нет, первой
 * строкой встаёт «Создать «…»».
 */
const props = defineProps<{
  open: boolean;
  participants: Participant[];
  hasMe: boolean;
  /** Сколько позиций назначено участнику — для подтверждения удаления */
  assignedCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  add: [name: string, isMe: boolean];
  remove: [id: string];
  setPaidBy: [id: string, paidById: string | null];
}>();

/** Ключ строки «Я»: имя может совпасть с контактом, идентичность — нет. */
const ME_ROW_KEY = '__me__';
const ME_NAME = 'Я';

interface PersonRow {
  key: string;
  name: string;
  color: string | null;
  /** Участник чека с этим именем, если он уже добавлен. */
  participant: Participant | null;
  isMe: boolean;
  /** Есть ли человек в контактах — иначе предлагаем сохранить. */
  inContacts: boolean;
}

const { trigger } = useHaptics();
const isDesktop = useIsDesktop();
const { userId } = useCurrentUser();
const { people, isLoading, createPerson } = usePeople(userId);

const searchQuery = ref('');
const searchInputRef = ref<InstanceType<typeof UInput> | null>(null);

/** Раскрытый селектор «кто платит» (id участника) */
const expandedPayerId = ref<string | null>(null);

/** Удаление в два тапа: первый — подтверждение на строке */
const confirmingRemoveId = ref<string | null>(null);
const { start: scheduleConfirmReset, stop: cancelConfirmReset } = useTimeoutFn(
  () => (confirmingRemoveId.value = null),
  2500,
  { immediate: false },
);

/** Имена, для которых createPerson ещё в полёте */
const savingKeys = ref<Set<string>>(new Set());

const meParticipant = computed(() => props.participants.find((p) => p.isMe) ?? null);

const participantByKey = computed(() => {
  const map = new Map<string, Participant>();
  for (const p of props.participants) {
    if (p.isMe) continue;
    map.set(personKey(p.name), p);
  }
  return map;
});

/** Контакты по алфавиту: порядок с сервера читался бы как случайный. */
const contacts = computed(() =>
  [...people.value]
    // Контакт с именем «Я» покрывает строка «Я» — иначе в списке было бы два
    // одинаковых человека, один из которых заводит второго участника-двойника.
    .filter((p) => personKey(p.name) !== personKey(ME_NAME))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
);

/**
 * Единый список: «Я», участники, которых нет в контактах (иначе введённое
 * руками имя исчезло бы из списка), затем все контакты целиком.
 */
const rows = computed<PersonRow[]>(() => {
  const list: PersonRow[] = [
    {
      key: ME_ROW_KEY,
      name: meParticipant.value?.name ?? ME_NAME,
      color: meParticipant.value?.color ?? null,
      participant: meParticipant.value,
      isMe: true,
      inContacts: true,
    },
  ];

  const contactKeys = new Set(contacts.value.map((c) => personKey(c.name)));
  for (const p of props.participants) {
    if (p.isMe) continue;
    const key = personKey(p.name);
    if (contactKeys.has(key)) continue;
    list.push({
      key,
      name: p.name,
      color: p.color,
      participant: p,
      isMe: false,
      inContacts: false,
    });
  }

  for (const contact of contacts.value) {
    const key = personKey(contact.name);
    list.push({
      key,
      name: contact.name,
      color: contact.color,
      participant: participantByKey.value.get(key) ?? null,
      isMe: false,
      inContacts: true,
    });
  }

  return list;
});

const query = computed(() => searchQuery.value.trim());

const filteredRows = computed(() => {
  const needle = query.value.toLowerCase();
  if (!needle) return rows.value;
  return rows.value.filter((row) => row.name.toLowerCase().includes(needle));
});

/** Имени нет ни среди участников, ни среди контактов — предлагаем завести. */
const canCreate = computed(() => {
  if (!query.value) return false;
  const key = personKey(query.value);
  return !rows.value.some((row) => row.key === key || personKey(row.name) === key);
});

const selectedCount = computed(() => props.participants.length);

const doneLabel = computed(() =>
  selectedCount.value > 0
    ? `Готово · ${selectedCount.value} ${pluralize(selectedCount.value, 'участник', 'участника', 'участников')}`
    : 'Готово',
);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      cancelConfirmReset();
      return;
    }
    searchQuery.value = '';
    expandedPayerId.value = null;
    confirmingRemoveId.value = null;
    await nextTick();
    if (!props.open) return;
    // Автофокус только на компьютере: на телефоне клавиатура сразу съела бы
    // половину шторки, а список открыт как раз чтобы выбирать пальцем.
    if (isDesktop.value) searchInputRef.value?.focus();
  },
);

function assignedCount(participant: Participant): number {
  return props.assignedCounts[participant.id] ?? 0;
}

/** Подпись под именем: позиции, плательщик или пометка «не в контактах». */
function rowMeta(row: PersonRow): string | null {
  if (row.participant) {
    const count = assignedCount(row.participant);
    if (count > 0) return `${count} ${pluralize(count, 'позиция', 'позиции', 'позиций')}`;
    return 'Без позиций';
  }
  if (!row.inContacts) return 'Не в контактах';
  return null;
}

function rowAriaLabel(row: PersonRow): string {
  if (!row.participant) return `Добавить ${row.name} в участники`;
  if (confirmingRemoveId.value === row.participant.id) {
    return `Подтвердить: убрать ${row.name} из участников`;
  }
  return `Убрать ${row.name} из участников`;
}

function payerName(participant: Participant): string | null {
  if (!participant.paidById) return null;
  return props.participants.find((p) => p.id === participant.paidById)?.name ?? null;
}

/** Кандидаты в плательщики: все, кроме самого участника и зависимых */
function payerOptions(participant: Participant): Participant[] {
  return props.participants.filter((p) => p.id !== participant.id && !p.paidById);
}

function togglePayerSelector(id: string) {
  expandedPayerId.value = expandedPayerId.value === id ? null : id;
  trigger('selection');
}

function choosePayer(participantId: string, paidById: string | null) {
  emit('setPaidBy', participantId, paidById);
  expandedPayerId.value = null;
}

function requestRemove(participant: Participant) {
  if (confirmingRemoveId.value === participant.id) {
    cancelConfirmReset();
    confirmingRemoveId.value = null;
    emit('remove', participant.id);
    return;
  }
  // Участник без позиций уходит сразу: подтверждать нечего, терять нечего.
  if (assignedCount(participant) === 0) {
    trigger('selection');
    emit('remove', participant.id);
    return;
  }
  trigger('warning');
  confirmingRemoveId.value = participant.id;
  scheduleConfirmReset();
}

function toggleRow(row: PersonRow) {
  if (row.participant) {
    requestRemove(row.participant);
    return;
  }
  trigger('selection');
  emit('add', row.isMe ? ME_NAME : row.name, row.isMe);
}

function handleCreate() {
  const name = query.value;
  if (!name || !canCreate.value) return;
  emit('add', name, false);
  searchQuery.value = '';
  trigger('selection');
  // Компанию обычно набирают подряд — оставляем фокус в поиске.
  nextTick(() => searchInputRef.value?.focus());
}

/** Enter на клавиатуре: добавляем первое совпадение или заводим новое имя. */
function handleSearchEnter() {
  const first = filteredRows.value[0];
  if (first && !first.participant) {
    toggleRow(first);
    searchQuery.value = '';
    return;
  }
  if (canCreate.value) handleCreate();
}

async function saveToContacts(row: PersonRow) {
  if (row.inContacts || savingKeys.value.has(row.key)) return;
  savingKeys.value = new Set(savingKeys.value).add(row.key);
  try {
    await createPerson({ name: row.name, color: row.color ?? undefined });
    trigger('success');
  } finally {
    const next = new Set(savingKeys.value);
    next.delete(row.key);
    savingKeys.value = next;
  }
}
</script>

<template>
  <UOverlay
    :model-value="open"
    title="Участники"
    desktop="panel"
    @update:model-value="emit('update:open', $event)"
  >
    <!-- Поиск липнет к верху: список длинный, а искать приходится в нём же -->
    <div
      class="sticky -top-4 -mx-5 -mt-4 z-10 bg-card-light dark:bg-card-dark px-5 pt-4 pb-3 space-y-2"
    >
      <UInput
        ref="searchInputRef"
        v-model="searchQuery"
        variant="search"
        placeholder="Поиск или новое имя..."
        aria-label="Поиск человека по имени"
        data-testid="participants-search"
        @keydown.enter.prevent="handleSearchEnter"
      />
      <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
        <template v-if="selectedCount > 0">
          Выбрано {{ selectedCount }} — тапните по человеку, чтобы добавить или убрать
        </template>
        <template v-else>Тапните по человеку, чтобы добавить его в чек</template>
      </p>
    </div>

    <div class="space-y-1 pb-1">
      <!-- Новое имя прямо из поиска — вместо отдельного поля ручного ввода -->
      <button
        v-if="canCreate"
        type="button"
        data-testid="participant-create"
        :aria-label="`Создать участника ${query}`"
        class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
        @click="handleCreate"
      >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <UIcon name="person_add" size="sm" class="text-primary" />
        </span>
        <span class="min-w-0 flex-1 truncate text-sm font-medium text-primary">
          Создать «{{ query }}»
        </span>
      </button>

      <div
        v-for="row in filteredRows"
        :key="row.key"
        :class="
          cn(
            'rounded-xl border transition-colors',
            row.participant
              ? 'border-primary/25 bg-primary/[0.05]'
              : 'border-transparent hover:bg-surface-light dark:hover:bg-surface-dark',
            row.participant && confirmingRemoveId === row.participant.id
              ? 'border-danger/40 bg-danger/[0.06]'
              : '',
          )
        "
      >
        <button
          type="button"
          data-testid="participant-row"
          :aria-pressed="!!row.participant"
          :aria-label="rowAriaLabel(row)"
          class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-transform active:scale-[0.99]"
          @click="toggleRow(row)"
        >
          <!-- «Я» до добавления цвета ещё не имеет — рисуем иконкой -->
          <span
            v-if="row.isMe && !row.color"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <UIcon name="person" size="sm" class="text-primary" />
          </span>
          <InitialAvatar v-else :name="row.name" :color="row.color ?? ''" size="md" translucent />

          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ row.name }}
              <span
                v-if="row.isMe"
                class="text-xs font-normal text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                (вы)
              </span>
            </span>
            <span
              v-if="rowMeta(row)"
              class="block truncate text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ rowMeta(row) }}
            </span>
          </span>

          <!-- Состояние справа: подтверждение → галочка → приглашение добавить -->
          <span
            v-if="row.participant && confirmingRemoveId === row.participant.id"
            class="shrink-0 rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white"
          >
            Убрать?
          </span>
          <span
            v-else-if="row.participant"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary"
            aria-hidden="true"
          >
            <UIcon name="check" size="xs" class="text-white" />
          </span>
          <span
            v-else
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-light dark:border-border-dark text-text-tertiary-light dark:text-text-tertiary-dark"
            aria-hidden="true"
          >
            <UIcon name="add" size="xs" />
          </span>
        </button>

        <!-- Настройки выбранного: кто за него платит и сохранение в контакты -->
        <div
          v-if="row.participant && (participants.length > 1 || !row.inContacts)"
          class="flex flex-wrap items-center gap-1.5 px-3 pb-2.5"
        >
          <button
            v-if="participants.length > 1"
            type="button"
            data-testid="payer-toggle"
            :aria-expanded="expandedPayerId === row.participant.id"
            :aria-label="`Кто платит за ${row.name}`"
            :class="
              cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                row.participant.paidById
                  ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                  : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark',
              )
            "
            @click="togglePayerSelector(row.participant.id)"
          >
            <UIcon name="payments" size="xs" />
            {{ row.participant.paidById ? `Платит ${payerName(row.participant)}` : 'Платит сам' }}
            <UIcon
              :name="expandedPayerId === row.participant.id ? 'expand_less' : 'expand_more'"
              size="xs"
            />
          </button>

          <button
            v-if="!row.inContacts"
            type="button"
            data-testid="save-to-contacts"
            :aria-label="`Сохранить ${row.name} в контакты`"
            :disabled="savingKeys.has(row.key)"
            class="inline-flex items-center gap-1 rounded-full border border-border-light dark:border-border-dark px-2.5 py-1 text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors disabled:opacity-50"
            @click="saveToContacts(row)"
          >
            <UIcon name="person_add" size="xs" />
            В контакты
          </button>
        </div>

        <!-- Раскрывающийся выбор плательщика -->
        <Transition name="section-slide">
          <div
            v-if="row.participant && expandedPayerId === row.participant.id"
            class="flex flex-wrap gap-1.5 border-t border-border-light/50 dark:border-border-dark/50 px-3 pt-2 pb-2.5"
          >
            <button
              type="button"
              data-testid="payer-option"
              :aria-pressed="row.participant.paidById === null"
              class="rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
              :class="
                row.participant.paidById === null
                  ? 'bg-primary text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
              "
              @click="choosePayer(row.participant.id, null)"
            >
              Сам
            </button>
            <button
              v-for="payer in payerOptions(row.participant)"
              :key="payer.id"
              type="button"
              data-testid="payer-option"
              :aria-pressed="row.participant.paidById === payer.id"
              :aria-label="`За ${row.name} платит ${payer.name}`"
              class="rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
              :class="
                row.participant.paidById === payer.id
                  ? 'text-white'
                  : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
              "
              :style="row.participant.paidById === payer.id ? { backgroundColor: payer.color } : {}"
              @click="choosePayer(row.participant.id, payer.id)"
            >
              {{ payer.name }}
            </button>
          </div>
        </Transition>
      </div>

      <p
        v-if="filteredRows.length === 0 && !canCreate"
        class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        {{ isLoading ? 'Загружаем контакты…' : 'Никого не нашлось' }}
      </p>
    </div>

    <template #footer>
      <UButton
        variant="primary"
        size="lg"
        full-width
        data-testid="participants-done"
        @click="emit('update:open', false)"
      >
        {{ doneLabel }}
      </UButton>
    </template>
  </UOverlay>
</template>

<style>
@import './transitions.css';
</style>
