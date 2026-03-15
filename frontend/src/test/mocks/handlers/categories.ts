import { http, HttpResponse } from 'msw';

export const mockCategoryResponses = [
  {
    id: 'cat-groceries',
    userId: 'test-user-1',
    name: 'Продукты',
    icon: 'shopping_basket',
    color: '#10b981',
    type: 'expense',
    sortOrder: 0,
    isFrequent: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-transport',
    userId: 'test-user-1',
    name: 'Транспорт',
    icon: 'directions_car',
    color: '#3b82f6',
    type: 'expense',
    sortOrder: 1,
    isFrequent: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-salary',
    userId: 'test-user-1',
    name: 'Зарплата',
    icon: 'payments',
    color: '#10b981',
    type: 'income',
    sortOrder: 0,
    isFrequent: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

export const categoryHandlers = [
  http.post('*/api/categories/initialize-defaults', () => {
    return HttpResponse.json(mockCategoryResponses);
  }),

  http.get('*/api/categories', () => {
    return HttpResponse.json(mockCategoryResponses);
  }),
];
