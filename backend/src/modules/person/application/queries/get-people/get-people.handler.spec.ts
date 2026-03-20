import { Test, type TestingModule } from '@nestjs/testing';
import { GetPeopleHandler } from './get-people.handler';
import { GetPeopleQuery } from './get-people.query';
import { PERSON_REPOSITORY } from '../../../domain/repositories';
import { Person } from '../../../domain/aggregates/person';

describe('GetPeopleHandler', () => {
  let handler: GetPeopleHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetPeopleHandler, { provide: PERSON_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetPeopleHandler>(GetPeopleHandler);
    jest.clearAllMocks();
  });

  it('should return a list of people for the user', async () => {
    const people = [
      Person.reconstitute({
        id: 'p-1',
        userId: 'user-1',
        name: 'John',
        color: '#FF0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }),
      Person.reconstitute({
        id: 'p-2',
        userId: 'user-1',
        name: 'Jane',
        color: '#00FF00',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01'),
      }),
    ];
    mockRepository.findByUserId.mockResolvedValue(people);

    const query = new GetPeopleQuery('user-1');
    const result = await handler.execute(query);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'p-1',
      userId: 'user-1',
      name: 'John',
      color: '#FF0000',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });
    expect(result[1].name).toBe('Jane');
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('should return an empty list when user has no people', async () => {
    mockRepository.findByUserId.mockResolvedValue([]);

    const query = new GetPeopleQuery('user-1');
    const result = await handler.execute(query);

    expect(result).toEqual([]);
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
