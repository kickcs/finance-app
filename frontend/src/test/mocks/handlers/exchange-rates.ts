import { http, HttpResponse } from 'msw';

export const exchangeRateHandlers = [
  http.get('*/api/exchange-rates/batch', () => {
    return HttpResponse.json({
      baseCurrency: 'UZS',
      rates: {
        USD: { rate: 0.0000794, updatedAt: '2025-01-01T00:00:00.000Z' },
        EUR: { rate: 0.0000735, updatedAt: '2025-01-01T00:00:00.000Z' },
        RUB: { rate: 0.00685, updatedAt: '2025-01-01T00:00:00.000Z' },
      },
    });
  }),
];
