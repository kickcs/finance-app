import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { IUserSubscriptionRepository, USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories';

interface AuthenticatedRequest extends Request {
  user?: { sub: string };
}

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Authentication required');

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription?.isPremium()) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }
}
