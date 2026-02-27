import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeletePersonCommand } from './delete-person.command';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(DeletePersonCommand)
export class DeletePersonHandler implements ICommandHandler<DeletePersonCommand> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(command: DeletePersonCommand): Promise<void> {
    const person = await this.personRepository.findById(command.id);
    if (!person) {
      throw new NotFoundException('Person not found');
    }
    if (person.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.personRepository.delete(command.id);
  }
}
