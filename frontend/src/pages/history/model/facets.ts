import { isPeriodActive, type HistoryPeriod } from '../lib/historyPeriod';

/** Чипы под вкладками типа; по этим именам их открывают и сбрасывают. */
export type FacetName = 'period' | 'category' | 'tag' | 'account';

/** Значения всех чипов: из них читается, выбран ли чип, и в них же он сбрасывается. */
export interface FacetValues {
  period: HistoryPeriod | null;
  categoryIds: string[];
  tags: string[];
  accountIds: string[];
}

interface FacetConfig {
  title: string;
  isSet: (values: FacetValues) => boolean;
  cleared: Partial<FacetValues>;
}

/** Порядок ключей — порядок чипов. */
export const FACETS: Record<FacetName, FacetConfig> = {
  period: { title: 'Период', isSet: (v) => isPeriodActive(v.period), cleared: { period: null } },
  category: {
    title: 'Категория',
    isSet: (v) => v.categoryIds.length > 0,
    cleared: { categoryIds: [] },
  },
  tag: { title: 'Тег', isSet: (v) => v.tags.length > 0, cleared: { tags: [] } },
  account: { title: 'Счёт', isSet: (v) => v.accountIds.length > 0, cleared: { accountIds: [] } },
};
