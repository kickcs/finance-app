import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UpdatePersonHandler } from './update-person.handler';
import { UpdatePersonCommand } from './update-person.command';
import { PERSON_REPOSITORY } from '../../../domain/repositories';
import { Person } from '../../../domain/aggregates/person';

describe('UpdatePersonHandler', () => {
  let handler: UpdatePersonHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdatePersonHandler, { provide: PERSON_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<UpdatePersonHandler>(UpdatePersonHandler);
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

  it('should update a person and return the response', async () => {
    const person = createPerson();
    mockRepository.findById.mockResolvedValue(person);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));

    const command = new UpdatePersonCommand('p-1', 'user-1', { name: 'Jane', color: '#FFFFFF' });
    const result = await handler.execute(command);

    expect(result.name).toBe('Jane');
    expect(result.color).toBe('#FFFFFF');
    expect(mockRepository.findById).toHaveBeenCalledWith('p-1');
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should update only name when color is not provided', async () => {
    const person = createPerson();
    mockRepository.findById.mockResolvedValue(person);
    mockRepository.save.mockImplementation((p) => Promise.resolve(p));

    const command = new UpdatePersonCommand('p-1', 'user-1', { name: 'Updated' });
    const result = await handler.execute(command);

    expect(result.name).toBe('Updated');
    expect(result.color).toBe('#000000');
  });

  it('should throw NotFoundException when person not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new UpdatePersonCommand('nonexistent', 'user-1', { name: 'Test' });

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    await expect(handler.execute(command)).rejects.toThrow('Person not found');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user does not own the person', async () => {
    const person = createPerson('other-user');
    mockRepository.findById.mockResolvedValue(person);

    const command = new UpdatePersonCommand('p-1', 'user-1', { name: 'Hack' });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    await expect(handler.execute(command)).rejects.toThrow('Access denied');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
