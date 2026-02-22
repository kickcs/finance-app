import { Test, type TestingModule } from '@nestjs/testing';
import { CreateCheckoutHandler } from './create-checkout.handler';
import { CreateCheckoutCommand } from './create-checkout.command';
import { USER_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { LemonSqueezyService } from '../../../infrastructure/lemonsqueezy';

describe('CreateCheckoutHandler', () => {
  let handler: CreateCheckoutHandler;
  const mockRepository = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByLemonSubscriptionId: jest.fn(),
    save: jest.fn(),
  };
  const mockLemonSqueezyService = {
    createCheckoutUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCheckoutHandler,
        {
          provide: USER_SUBSCRIPTION_REPOSITORY,
          useValue: mockRepository,
        },
        {
          provide: LemonSqueezyService,
          useValue: mockLemonSqueezyService,
        },
      ],
    }).compile();

    handler = module.get<CreateCheckoutHandler>(CreateCheckoutHandler);

    jest.clearAllMocks();
  });

  it('should create free subscription if none exists and return checkout URL', async () => {
    mockRepository.findByUserId.mockResolvedValue(null);
    mockRepository.save.mockImplementation((sub) => Promise.resolve(sub));
    mockLemonSqueezyService.createCheckoutUrl.mockResolvedValue(
      'https://checkout.lemonsqueezy.com/test',
    );

    const command = new CreateCheckoutCommand('user-1', 'user@test.com', 'premium_monthly');

    const result = await handler.execute(command);

    expect(result).toEqual({
      checkoutUrl: 'https://checkout.lemonsqueezy.com/test',
    });
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
    expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(mockLemonSqueezyService.createCheckoutUrl).toHaveBeenCalledWith({
      userId: 'user-1',
      userEmail: 'user@test.com',
      plan: 'premium_monthly',
    });
  });

  it('should return checkout URL for existing user with subscription record', async () => {
    const existingSubscription = UserSubscription.createFree('sub-1', 'user-1');
    mockRepository.findByUserId.mockResolvedValue(existingSubscription);
    mockLemonSqueezyService.createCheckoutUrl.mockResolvedValue(
      'https://checkout.lemonsqueezy.com/existing',
    );

    const command = new CreateCheckoutCommand('user-1', 'user@test.com', 'premium_yearly');

    const result = await handler.execute(command);

    expect(result).toEqual({
      checkoutUrl: 'https://checkout.lemonsqueezy.com/existing',
    });
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
    expect(mockRepository.save).not.toHaveBeenCalled();
    expect(mockLemonSqueezyService.createCheckoutUrl).toHaveBeenCalledWith({
      userId: 'user-1',
      userEmail: 'user@test.com',
      plan: 'premium_yearly',
    });
  });
});
