import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeletePersonHandler } from './delete-person.handler';
import { DeletePersonCommand } from './delete-person.command';
import { PERSON_REPOSITORY } from '../../../domain/repositories';
import { Person } from '../../../domain/aggregates/person';

describe('DeletePersonHandler', () => {
  let handler: DeletePersonHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeletePersonHandler, { provide: PERSON_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<DeletePersonHandler>(DeletePersonHandler);
    jest.clearAllMocks();
  });

  function createPerson(userId = 'user-1'): Person {
    return Person.reconstitute({
      id: 'p-1',
      userId,
      name: 'John',
      color: '#000000',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });
  }

  it('should delete a person owned by the user', async () => {
    const person = createPerson();
    mockRepository.findById.mockResolvedValue(person);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeletePersonCommand('p-1', 'user-1');
    await handler.execute(command);

    expect(mockRepository.findById).toHaveBeenCalledWith('p-1');
    expect(mockRepository.delete).toHaveBeenCalledWith('p-1');
  });

  it('should throw NotFoundException when person not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new DeletePersonCommand('nonexistent', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    await expect(handler.execute(command)).rejects.toThrow('Person not found');
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user does not own the person', async () => {
    const person = createPerson('other-user');
    mockRepository.findById.mockResolvedValue(person);

    const command = new DeletePersonCommand('p-1', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    await expect(handler.execute(command)).rejects.toThrow('Access denied');
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
