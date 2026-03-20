import { Test, type TestingModule } from '@nestjs/testing';
import { CreateCategoryHandler } from './create-category.handler';
import { CreateCategoryCommand } from './create-category.command';
import { CATEGORY_REPOSITORY } from '../../../domain/repositories/category.repository.interface';

describe('CreateCategoryHandler', () => {
  let handler: CreateCategoryHandler;
  const mockCategoryRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByUserIdAndType: jest.fn(),
    save: jest.fn(),
    saveMany: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    updateSortOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCategoryHandler,
        { provide: CATEGORY_REPOSITORY, useValue: mockCategoryRepository },
      ],
    }).compile();

    handler = module.get<CreateCategoryHandler>(CreateCategoryHandler);
    jest.clearAllMocks();
  });

  it('should create an expense category and return response', async () => {
    mockCategoryRepository.save.mockImplementation((cat) => Promise.resolve(cat));

    const command = new CreateCategoryCommand('user-1', 'Food', 'restaurant', '#FF5733', 'expense');

    const result = await handler.execute(command);

    expect(result.userId).toBe('user-1');
    expect(result.name).toBe('Food');
    expect(result.icon).toBe('restaurant');
    expect(result.color).toBe('#FF5733');
    expect(result.type).toBe('expense');
    expect(result.sortOrder).toBe(0);
    expect(result.isFrequent).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(mockCategoryRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should create an income category', async () => {
    mockCategoryRepository.save.mockImplementation((cat) => Promise.resolve(cat));

    const command = new CreateCategoryCommand('user-1', 'Salary', 'work', '#00FF00', 'income');

    const result = await handler.execute(command);

    expect(result.type).toBe('income');
  });

  it('should create category with custom sortOrder and isFrequent', async () => {
    mockCategoryRepository.save.mockImplementation((cat) => Promise.resolve(cat));

    const command = new CreateCategoryCommand(
      'user-1',
      'Misc',
      'misc',
      '#000',
      'expense',
      5,
      false,
    );

    const result = await handler.execute(command);

    expect(result.sortOrder).toBe(5);
    expect(result.isFrequent).toBe(false);
  });
});
