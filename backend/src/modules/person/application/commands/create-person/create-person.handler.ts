import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreatePersonCommand } from './create-person.command';
import { Person } from '../../../domain/aggregates/person';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';
import { PersonResponseMapper } from '../../mappers';

@CommandHandler(CreatePersonCommand)
export class CreatePersonHandler implements ICommandHandler<CreatePersonCommand> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(command: CreatePersonCommand) {
    const person = Person.create(crypto.randomUUID(), command.userId, command.name, command.color);

    const savedPerson = await this.personRepository.save(person);

    return PersonResponseMapper.toResponse(savedPerson);
  }
}
