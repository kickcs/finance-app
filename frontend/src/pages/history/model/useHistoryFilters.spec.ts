import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { http, HttpResponse } from 'msw';
import { mountComposable, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { normalizeStoredFilters, useHistoryFilters } from './useHistoryFilters';

const KEY = STORAGE_KEYS.HISTORY_FILTERS;

let mounted: ReturnType<typeof mountComposable<ReturnType<typeof useHistoryFilters>>> | null = null;

async function setup(stored?: string) {
  if (stored !== undefined) sessionStorage.setItem(KEY, stored);
  mounted = mountComposable(() => useHistoryFilters(() => mockUser.id), {
    provideAuth: { user: mockUser },
  });
  // Категории и профиль приходят по сети — ждём, пока usedCategories и startDay устоятся.
  await flushPromises();
  await flushPromises();
  return mounted.result;
}

/** Хранилище пишется отложенно (watch), поэтому перед чтением даём ему отработать. */
async function readStored() {
  await nextTick();
  await flushPromises();
  return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
}

describe('useHistoryFilters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(async () => {
    mounted?.wrapper.unmount();
    mounted = null;
    vi.useRealTimers();
    await flushPromises();
  });

  describe('значения по умолчанию', () => {
    it('ничего не выбрано и серверный фильтр пуст', async () => {
      const f = await setup();

      expect(f.activeTypeFilter.value).toBe('all');
      expect(f.selectedCategoryIds.value).toEqual([]);
      expect(f.selectedTags.value).toEqual([]);
      expect(f.selectedAccountIds.value).toEqual([]);
      expect(f.period.value).toBeNull();
      expect(f.activeFacetCount.value).toBe(0);
      expect(f.hasActiveFilters.value).toBe(false);
      expect(Object.values(f.serverFilters.value).every((v) => v === undefined)).toBe(true);
    });
  });

  describe('чтение прежней и испорченной формы хранилища', () => {
    it('одиночные accountId/categoryId становятся массивами', async () => {
      const f = await setup(
        JSON.stringify({ type: 'expense', accountId: 'acc-1', categoryId: 'cat-groceries' }),
      );

      expect(f.activeTypeFilter.value).toBe('expense');
      expect(f.selectedAccountIds.value).toEqual(['acc-1']);
      expect(f.selectedCategoryIds.value).toEqual(['cat-groceries']);
      expect(f.serverFilters.value).toMatchObject({
        type: 'expense',
        account_ids: ['acc-1'],
        category_ids: ['cat-groceries'],
      });
    });

    it('null в прежней форме — это «не выбрано»', async () => {
      const f = await setup(JSON.stringify({ type: 'income', accountId: null, categoryId: null }));

      expect(f.activeTypeFilter.value).toBe('income');
      expect(f.selectedAccountIds.value).toEqual([]);
      expect(f.selectedCategoryIds.value).toEqual([]);
    });

    it('после первой правки в хранилище лежит только новая форма', async () => {
      const f = await setup(
        JSON.stringify({ type: 'expense', accountId: 'acc-1', categoryId: 'cat-groceries' }),
      );

      f.selectedTags.value = ['кафе'];

      expect(await readStored()).toEqual({
        type: 'expense',
        categoryIds: ['cat-groceries'],
        tags: ['кафе'],
        accountIds: ['acc-1'],
        period: null,
      });
    });

    it.each([
      ['битый JSON', '{"type": "exp'],
      ['null', 'null'],
      ['массив', '[1,2,3]'],
      ['число', '42'],
    ])('%s даёт значения по умолчанию', async (_name, raw) => {
      const f = await setup(raw);

      expect(f.activeTypeFilter.value).toBe('all');
      expect(f.hasActiveFilters.value).toBe(false);
    });

    it('частичный объект: неизвестный тип и «#» в тегах чинятся, остальное сохраняется', async () => {
      const f = await setup(
        JSON.stringify({ type: 'bogus', tags: ['#кафе', 'такси', '#кафе', 5] }),
      );

      expect(f.activeTypeFilter.value).toBe('all');
      expect(f.selectedTags.value).toEqual(['кафе', 'такси']);
      expect(f.selectedCategoryIds.value).toEqual([]);
    });

    it('период с неверным пресетом или датами отбрасывается', () => {
      expect(normalizeStoredFilters({ period: { preset: 'year' } }).period).toBeNull();
      expect(
        normalizeStoredFilters({ period: { preset: 'custom', from: 'вчера', to: '2026-10-20' } })
          .period,
      ).toEqual({ preset: 'custom', from: null, to: '2026-10-20' });
      expect(
        normalizeStoredFilters({ period: { preset: 'last7', from: '2026-10-01', to: null } })
          .period,
      ).toEqual({ preset: 'last7', from: null, to: null });
    });
  });

  describe('мультивыбор и серверный фильтр', () => {
    it('несколько категорий, счетов и тегов попадают в фильтр списками', async () => {
      const f = await setup();

      f.selectedCategoryIds.value = ['cat-groceries', 'cat-transport'];
      f.selectedAccountIds.value = ['acc-1', 'acc-2'];
      f.selectedTags.value = ['кафе'];

      expect(f.serverFilters.value).toMatchObject({
        category_ids: ['cat-groceries', 'cat-transport'],
        account_ids: ['acc-1', 'acc-2'],
        tags: ['кафе'],
      });
      expect(f.activeFacetCount.value).toBe(3);
    });

    it('пустые списки в фильтр не попадают — только undefined', async () => {
      const f = await setup();

      f.selectedCategoryIds.value = ['cat-groceries'];
      f.selectedCategoryIds.value = [];

      expect(f.serverFilters.value.category_ids).toBeUndefined();
      expect(f.serverFilters.value.account_ids).toBeUndefined();
      expect(f.serverFilters.value.tags).toBeUndefined();
    });

    it('тип «Все» в фильтр не передаётся', async () => {
      const f = await setup();

      f.handleTypeFilterChange('income');
      expect(f.serverFilters.value.type).toBe('income');

      f.handleTypeFilterChange('all');
      expect(f.serverFilters.value.type).toBeUndefined();
    });

    it('тип без чипов считается активным фильтром, но не чипом', async () => {
      const f = await setup();

      f.handleTypeFilterChange('expense');

      expect(f.activeFacetCount.value).toBe(0);
      expect(f.hasActiveFilters.value).toBe(true);
    });
  });

  describe('период', () => {
    it('пресет превращается в даты от текущего момента', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 31, 12));
      const f = await setup();

      f.period.value = { preset: 'last7', from: null, to: null };

      expect(f.serverFilters.value).toMatchObject({
        start_date: '2026-10-25',
        end_date: '2026-10-31',
      });
      expect(f.activeFacetCount.value).toBe(1);
    });

    it('«Этот месяц» учитывает день начала финансового месяца из профиля', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({ ...mockProfileResponse, financialMonthStartDay: 15 }),
        ),
      );
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 10, 12));
      const f = await setup();

      f.period.value = { preset: 'month', from: null, to: null };

      expect(f.serverFilters.value).toMatchObject({
        start_date: '2026-09-15',
        end_date: '2026-10-10',
      });
    });

    it('свой период с одной границей отправляет только её', async () => {
      const f = await setup();

      f.period.value = { preset: 'custom', from: '2026-10-12', to: null };

      expect(f.serverFilters.value.start_date).toBe('2026-10-12');
      expect(f.serverFilters.value.end_date).toBeUndefined();
    });

    it('свой период без дат не считается активным чипом', async () => {
      const f = await setup();

      f.period.value = { preset: 'custom', from: null, to: null };

      expect(f.activeFacetCount.value).toBe(0);
      expect(f.hasActiveFilters.value).toBe(false);
    });
  });

  describe('сброс', () => {
    async function withAllFacets() {
      const f = await setup();
      f.handleTypeFilterChange('expense');
      f.selectedCategoryIds.value = ['cat-groceries'];
      f.selectedTags.value = ['кафе'];
      f.selectedAccountIds.value = ['acc-1'];
      f.period.value = { preset: 'month', from: null, to: null };
      return f;
    }

    it.each([
      ['period', 'period'],
      ['category', 'selectedCategoryIds'],
      ['tag', 'selectedTags'],
      ['account', 'selectedAccountIds'],
    ] as const)('clearFacet(%s) сбрасывает только свой чип', async (facet, key) => {
      const f = await withAllFacets();

      f.clearFacet(facet);

      expect(f.activeFacetCount.value).toBe(3);
      expect(f.activeTypeFilter.value).toBe('expense');
      expect(f[key].value).toEqual(key === 'period' ? null : []);
    });

    it('resetAll возвращает всё к умолчанию, включая вкладку', async () => {
      const f = await withAllFacets();

      f.resetAll();

      expect(f.activeFacetCount.value).toBe(0);
      expect(f.activeTypeFilter.value).toBe('all');
      expect(f.hasActiveFilters.value).toBe(false);
    });
  });

  describe('смена вкладки типа', () => {
    it('отбрасывает несовместимые категории и оставляет совместимые', async () => {
      const f = await setup();
      f.selectedCategoryIds.value = ['cat-groceries', 'cat-salary', 'cat-transport'];

      f.handleTypeFilterChange('expense');
      expect(f.selectedCategoryIds.value).toEqual(['cat-groceries', 'cat-transport']);

      f.handleTypeFilterChange('income');
      expect(f.selectedCategoryIds.value).toEqual([]);
    });

    it('на «Все» остаются все выбранные категории', async () => {
      const f = await setup();
      f.selectedCategoryIds.value = ['cat-groceries', 'cat-salary'];

      f.handleTypeFilterChange('all');

      expect(f.selectedCategoryIds.value).toEqual(['cat-groceries', 'cat-salary']);
    });

    it('у переводов категорий нет — выбор очищается', async () => {
      const f = await setup();
      f.selectedCategoryIds.value = ['cat-groceries'];

      f.handleTypeFilterChange('transfer');

      expect(f.selectedCategoryIds.value).toEqual([]);
    });

    it('счета, теги и период от смены вкладки не страдают', async () => {
      const f = await setup();
      f.selectedAccountIds.value = ['acc-1'];
      f.selectedTags.value = ['кафе'];
      f.period.value = { preset: 'last30', from: null, to: null };

      f.handleTypeFilterChange('income');

      expect(f.selectedAccountIds.value).toEqual(['acc-1']);
      expect(f.selectedTags.value).toEqual(['кафе']);
      expect(f.period.value?.preset).toBe('last30');
    });

    it('facetValues читает и пишет все чипы одним объектом', async () => {
      const f = await setup();
      f.facetValues.value = { ...f.facetValues.value, tags: ['кафе'], accountIds: ['acc-1'] };

      expect(f.selectedTags.value).toEqual(['кафе']);
      expect(f.facetValues.value).toEqual({
        period: null,
        categoryIds: [],
        tags: ['кафе'],
        accountIds: ['acc-1'],
      });
    });

    it('usedCategories следует за вкладкой', async () => {
      const f = await setup();

      f.handleTypeFilterChange('income');
      expect(f.usedCategories.value.map((c) => c.id)).toEqual(['cat-salary']);

      f.handleTypeFilterChange('expense');
      expect(f.usedCategories.value.map((c) => c.id)).toEqual(['cat-groceries', 'cat-transport']);
    });
  });

  describe('после массовой правки', () => {
    async function withExpenseFacets() {
      const f = await setup();
      f.handleTypeFilterChange('expense');
      f.selectedCategoryIds.value = ['cat-groceries'];
      f.selectedTags.value = ['кафе'];
      f.selectedAccountIds.value = ['acc-1'];
      f.period.value = { preset: 'last30', from: null, to: null };
      return f;
    }

    it('перенос в категорию меняет только категории, совместимый тип остаётся', async () => {
      const f = await withExpenseFacets();

      f.showAfterCategoryMove('cat-transport');

      expect(f.activeTypeFilter.value).toBe('expense');
      expect(f.selectedCategoryIds.value).toEqual(['cat-transport']);
      expect(f.selectedTags.value).toEqual(['кафе']);
      expect(f.selectedAccountIds.value).toEqual(['acc-1']);
      expect(f.period.value?.preset).toBe('last30');
    });

    it('тип, несовместимый с целевой категорией, сбрасывается на «Все»', async () => {
      const f = await withExpenseFacets();

      f.showAfterCategoryMove('cat-salary');

      expect(f.activeTypeFilter.value).toBe('all');
      expect(f.selectedCategoryIds.value).toEqual(['cat-salary']);
      expect(f.selectedTags.value).toEqual(['кафе']);
    });

    it('после «Сделать переводом» — целевой счёт, тип «Все», без категорий и тегов', async () => {
      const f = await withExpenseFacets();

      f.showAfterTransfer('acc-2');

      expect(f.activeTypeFilter.value).toBe('all');
      expect(f.selectedCategoryIds.value).toEqual([]);
      expect(f.selectedTags.value).toEqual([]);
      expect(f.selectedAccountIds.value).toEqual(['acc-2']);
      expect(f.period.value?.preset).toBe('last30');
    });
  });
});
