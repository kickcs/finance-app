import { http, HttpResponse } from 'msw';

export const mockSubscriptionStatusResponse = {
  plan: 'free',
  status: 'active',
  isPremium: false,
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export const subscriptionHandlers = [
  http.get('*/api/subscription/status', () => {
    return HttpResponse.json(mockSubscriptionStatusResponse);
  }),

  http.post('*/api/subscription/checkout', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      checkoutUrl: `https://checkout.lemonsqueezy.com/test?plan=${body.plan}`,
    });
  }),
];
