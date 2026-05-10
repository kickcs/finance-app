import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ResumeSubscriptionCommand } from './resume-subscription.command';
import {
  IRecurringSubscriptionRepository,
  RECURRING_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { SubscriptionResponseMapper } from '../../mappers';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';

@CommandHandler(ResumeSubscriptionCommand)
export class ResumeSubscriptionHandler implements ICommandHandler<ResumeSubscriptionCommand> {
  constructor(
    @Inject(RECURRING_SUBSCRIPTION_REPOSITORY)
    private readonly repository: IRecurringSubscriptionRepository,
  ) {}

  async execute(command: ResumeSubscriptionCommand) {
    const subscription = await this.repository.findById(command.id);
    if (subscription?.userId !== command.userId) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.resume();

    // BUG-13: re-anchor a stale billingDate so the cron sees a current
    // calendar day and can resume notifications/auto-charges. Without this,
    // a subscription paused for months keeps the original anchor and never
    // matches `todayInTz` again.
    const today = new Date();
    const nextDue = RecurringSubscription.nextDueOnOrAfter(
      subscription.billingDate,
      today,
      subscription.frequency,
      subscription.frequencyDays,
    );
    if (nextDue.getTime() !== subscription.billingDate.getTime()) {
      subscription.update({ billingDate: nextDue });
    }

    const saved = await this.repository.save(subscription);
    return SubscriptionResponseMapper.toResponse(saved);
  }
}
