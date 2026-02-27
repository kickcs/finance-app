import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { PERSON_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { PersonOrmEntity } from './infrastructure/persistence/typeorm';
import { PersonRepository } from './infrastructure/persistence/repositories';
import { PeopleController } from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([PersonOrmEntity])],
  controllers: [PeopleController],
  providers: [
    { provide: PERSON_REPOSITORY, useClass: PersonRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PERSON_REPOSITORY],
})
export class PersonModule {}
