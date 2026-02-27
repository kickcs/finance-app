import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdatePersonCommand } from './update-person.command';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';
import { PersonResponseMapper } from '../../mappers';

@CommandHandler(UpdatePersonCommand)
export class UpdatePersonHandler implements ICommandHandler<UpdatePersonCommand> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(command: UpdatePersonCommand) {
    const person = await this.personRepository.findById(command.id);
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    if (person.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    person.update(command.data);
    const savedPerson = await this.personRepository.save(person);

    return PersonResponseMapper.toResponse(savedPerson);
  }
}
