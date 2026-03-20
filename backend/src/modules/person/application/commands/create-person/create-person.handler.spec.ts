import { Test, type TestingModule } from '@nestjs/testing';
import { CreatePersonHandler } from './create-person.handler';
import { CreatePersonCommand } from './create-person.command';
import { PERSON_REPOSITORY } from '../../../domain/repositories';
import { Person } from '../../../domain/aggregates/person';

describe('CreatePersonHandler', () => {
  let handler: CreatePersonHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreatePersonHandler, { provide: PERSON_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<CreatePersonHandler>(CreatePersonHandler);
    jest.clearAllMocks();
  });

  it('should create a person and return the response', async () => {
    const savedPerson = Person.create('p-1', 'user-1', 'John Doe', '#FF0000');
    mockRepository.save.mockResolvedValue(savedPerson);

    const command = new CreatePersonCommand('user-1', 'John Doe', '#FF0000');
    const result = await handler.execute(command);

    expect(result.userId).toBe('user-1');
    expect(result.name).toBe('John Doe');
    expect(result.color).toBe('#FF0000');
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        _userId: 'user-1',
      }),
    );
  });

  it('should pass through different colors', async () => {
    const savedPerson = Person.create('p-2', 'user-1', 'Jane', '#00FF00');
    mockRepository.save.mockResolvedValue(savedPerson);

    const command = new CreatePersonCommand('user-1', 'Jane', '#00FF00');
    const result = await handler.execute(command);

    expect(result.name).toBe('Jane');
    expect(result.color).toBe('#00FF00');
  });
});
