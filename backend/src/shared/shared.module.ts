import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DomainEventPublisher } from './infrastructure/event-bus';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [DomainEventPublisher],
  exports: [CqrsModule, DomainEventPublisher],
})
export class SharedModule {}
