import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleWebhookHandler } from './handle-webhook.handler';
import { HandleWebhookCommand } from './handle-webhook.command';
import { USER_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import {
  LemonSqueezyWebhookService,
  type LemonSqueezyWebhookEvent,
} from '../../../infrastructure/lemonsqueezy';
import { SubscriptionPlan, SubscriptionStatus } from '../../../domain/value-objects';

const MOCK_VARIANT_CONFIG: Record<string, string> = {
  LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID: '100',
  LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID: '200',
};

describe('HandleWebhookHandler', () => {
  let handler: HandleWebhookHandler;
  const mockRepository = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByLemonSubscriptionId: jest.fn(),
    save: jest.fn(),
  };
  const mockWebhookService = {
    verifySignature: jest.fn(),
    parseEvent: jest.fn(),
  };
  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => MOCK_VARIANT_CONFIG[key]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookHandler,
        {
          provide: USER_SUBSCRIPTION_REPOSITORY,
          useValue: mockRepository,
        },
        {
          provide: LemonSqueezyWebhookService,
          useValue: mockWebhookService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    handler = module.get<HandleWebhookHandler>(HandleWebhookHandler);

    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockImplementation((key: string) => MOCK_VARIANT_CONFIG[key]);
  });

  function makeCommand(event: LemonSqueezyWebhookEvent): HandleWebhookCommand {
    const rawBody = Buffer.from(JSON.stringify(event));
    return new HandleWebhookCommand(rawBody, 'valid-signature');
  }

  function makeEvent(
    eventName: string,
    overrides: Partial<LemonSqueezyWebhookEvent['data']['attributes']> = {},
    customData?: { user_id?: string },
  ): LemonSqueezyWebhookEvent {
    return {
      meta: {
        event_name: eventName,
        custom_data: customData ?? { user_id: 'user-1' },
      },
      data: {
        id: 'lemon-sub-1',
        type: 'subscriptions',
        attributes: {
          store_id: 1,
          customer_id: 123,
          variant_id: 100,
          status: 'active',
          trial_ends_at: null,
          renews_at: '2026-03-22T00:00:00Z',
          ends_at: null,
          created_at: '2026-02-22T00:00:00Z',
          updated_at: '2026-02-22T00:00:00Z',
          ...overrides,
        },
      },
    };
  }

  it('should throw UnauthorizedException for invalid signature', async () => {
    mockWebhookService.verifySignature.mockReturnValue(false);

    const command = new HandleWebhookCommand(Buffer.from('{}'), 'invalid-sig');

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(mockWebhookService.verifySignature).toHaveBeenCalled();
  });

  it('should handle subscription_created event and activate subscription', async () => {
    const event = makeEvent('subscription_created');
    const command = makeCommand(event);
    const freeSubscription = UserSubscription.createFree('sub-1', 'user-1');

    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.parseEvent.mockReturnValue(event);
    mockRepository.findByUserId.mockResolvedValue(freeSubscription);
    mockRepository.save.mockImplementation((sub) => Promise.resolve(sub));

    await handler.execute(command);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const savedSub = mockRepository.save.mock.calls[0][0] as UserSubscription;
    expect(savedSub.planValue).toBe('premium_monthly');
    expect(savedSub.statusValue).toBe('active');
    expect(savedSub.isPremium()).toBe(true);
    expect(savedSub.lemonSubscriptionId).toBe('lemon-sub-1');
  });

  it('should create new subscription if none exists for subscription_created', async () => {
    const event = makeEvent('subscription_created');
    const command = makeCommand(event);

    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.parseEvent.mockReturnValue(event);
    mockRepository.findByUserId.mockResolvedValue(null);
    mockRepository.save.mockImplementation((sub) => Promise.resolve(sub));

    await handler.execute(command);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const savedSub = mockRepository.save.mock.calls[0][0] as UserSubscription;
    expect(savedSub.planValue).toBe('premium_monthly');
    expect(savedSub.isPremium()).toBe(true);
  });

  it('should handle subscription_cancelled event and mark cancel at period end', async () => {
    const event = makeEvent('subscription_cancelled');
    const command = makeCommand(event);
    const activeSubscription = UserSubscription.reconstitute({
      id: 'sub-1',
      userId: 'user-1',
      plan: SubscriptionPlan.PREMIUM_MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      lemonCustomerId: 'cust-1',
      lemonSubscriptionId: 'lemon-sub-1',
      variantId: '100',
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: new Date('2026-02-22'),
      currentPeriodEnd: new Date('2026-03-22'),
      cancelAtPeriodEnd: false,
      source: 'lemonsqueezy',
      originalTransactionId: null,
      appAccountToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.parseEvent.mockReturnValue(event);
    mockRepository.findByUserId.mockResolvedValue(activeSubscription);
    mockRepository.save.mockImplementation((sub) => Promise.resolve(sub));

    await handler.execute(command);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const savedSub = mockRepository.save.mock.calls[0][0] as UserSubscription;
    expect(savedSub.cancelAtPeriodEnd).toBe(true);
    expect(savedSub.isPremium()).toBe(true); // still premium until period end
  });

  it('should handle subscription_expired event and deactivate subscription', async () => {
    const event = makeEvent('subscription_expired');
    const command = makeCommand(event);
    const activeSubscription = UserSubscription.reconstitute({
      id: 'sub-1',
      userId: 'user-1',
      plan: SubscriptionPlan.PREMIUM_MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      lemonCustomerId: 'cust-1',
      lemonSubscriptionId: 'lemon-sub-1',
      variantId: '100',
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: new Date('2026-01-22'),
      currentPeriodEnd: new Date('2026-02-22'),
      cancelAtPeriodEnd: true,
      source: 'lemonsqueezy',
      originalTransactionId: null,
      appAccountToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.parseEvent.mockReturnValue(event);
    mockRepository.findByUserId.mockResolvedValue(activeSubscription);
    mockRepository.save.mockImplementation((sub) => Promise.resolve(sub));

    await handler.execute(command);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const savedSub = mockRepository.save.mock.calls[0][0] as UserSubscription;
    expect(savedSub.planValue).toBe('free');
    expect(savedSub.statusValue).toBe('expired');
    expect(savedSub.isPremium()).toBe(false);
    expect(savedSub.cancelAtPeriodEnd).toBe(false);
  });

  it('should handle trialing status from subscription_created', async () => {
    const event = makeEvent('subscription_created', {
      status: 'on_trial',
      trial_ends_at: '2026-03-01T00:00:00Z',
    });
    const command = makeCommand(event);

    mockWebhookService.verifySignature.mockReturnValue(true);
    mockWebhookService.parseEvent.mockReturnValue(event);
    mockRepository.findByUserId.mockResolvedValue(null);
    mockRepository.save.mockImplementation((sub) => Promise.resolve(sub));

    await handler.execute(command);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const savedSub = mockRepository.save.mock.calls[0][0] as UserSubscription;
    expect(savedSub.statusValue).toBe('trialing');
    expect(savedSub.trialEnd).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(savedSub.isPremium()).toBe(true);
  });
});
