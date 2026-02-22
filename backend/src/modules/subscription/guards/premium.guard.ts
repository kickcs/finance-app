import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../domain/repositories';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Authentication required');

    const subscription =
      await this.subscriptionRepository.findByUserId(userId);
    if (!subscription || !subscription.isPremium()) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }
}
