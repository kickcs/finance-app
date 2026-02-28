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

interface CacheEntry {
  isPremium: boolean;
  checkedAt: number;
}

@Injectable()
export class PremiumGuard implements CanActivate {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000;

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('Authentication required');

    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.checkedAt < this.TTL_MS) {
      if (!cached.isPremium) {
        throw new ForbiddenException('Premium subscription required');
      }
      return true;
    }
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    const isPremium = subscription?.isPremium() ?? false;

    this.cache.set(userId, { isPremium, checkedAt: Date.now() });

    if (!isPremium) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }

  clearCache(userId: string) {
    this.cache.delete(userId);
  }
}
