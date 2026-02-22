import { Test, type TestingModule } from '@nestjs/testing';
import {
  GetSubscriptionStatusHandler,
  type SubscriptionStatusResponse,
} from './get-subscription-status.handler';
import { GetSubscriptionStatusQuery } from './get-subscription-status.query';
import { USER_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { SubscriptionPlan, SubscriptionStatus } from '../../../domain/value-objects';

describe('GetSubscriptionStatusHandler', () => {
  let handler: GetSubscriptionStatusHandler;
  const mockRepository = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByLemonSubscriptionId: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetSubscriptionStatusHandler,
        {
          provide: USER_SUBSCRIPTION_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    handler = module.get<GetSubscriptionStatusHandler>(GetSubscriptionStatusHandler);

    jest.clearAllMocks();
  });

  it('should return free plan when no subscription exists', async () => {
    mockRepository.findByUserId.mockResolvedValue(null);

    const result: SubscriptionStatusResponse = await handler.execute(
      new GetSubscriptionStatusQuery('user-1'),
    );

    expect(result).toEqual({
      plan: 'free',
      status: 'active',
      isPremium: false,
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should return premium status when subscription is active premium', async () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subscription = UserSubscription.reconstitute({
      id: 'sub-1',
      userId: 'user-1',
      plan: SubscriptionPlan.PREMIUM_MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      lemonCustomerId: 'cust-1',
      lemonSubscriptionId: 'lemon-sub-1',
      variantId: 'variant-1',
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    mockRepository.findByUserId.mockResolvedValue(subscription);

    const result = await handler.execute(new GetSubscriptionStatusQuery('user-1'));

    expect(result).toEqual({
      plan: 'premium_monthly',
      status: 'active',
      isPremium: true,
      trialEnd: null,
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    });
  });

  it('should return trial info when subscription is trialing', async () => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subscription = UserSubscription.reconstitute({
      id: 'sub-2',
      userId: 'user-2',
      plan: SubscriptionPlan.PREMIUM_YEARLY,
      status: SubscriptionStatus.TRIALING,
      lemonCustomerId: 'cust-2',
      lemonSubscriptionId: 'lemon-sub-2',
      variantId: 'variant-2',
      trialStart: now,
      trialEnd: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    mockRepository.findByUserId.mockResolvedValue(subscription);

    const result = await handler.execute(new GetSubscriptionStatusQuery('user-2'));

    expect(result).toEqual({
      plan: 'premium_yearly',
      status: 'trialing',
      isPremium: true,
      trialEnd: trialEnd.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    });
  });
});
