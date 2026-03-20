import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ReorderCategoriesHandler } from './reorder-categories.handler';
import { ReorderCategoriesCommand } from './reorder-categories.command';
import { CATEGORY_REPOSITORY } from '../../../domain/repositories/category.repository.interface';
import { Category } from '../../../domain/aggregates/category';

describe('ReorderCategoriesHandler', () => {
  let handler: ReorderCategoriesHandler;
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
        ReorderCategoriesHandler,
        { provide: CATEGORY_REPOSITORY, useValue: mockCategoryRepository },
      ],
    }).compile();

    handler = module.get<ReorderCategoriesHandler>(ReorderCategoriesHandler);
    jest.clearAllMocks();
  });

  it('should reorder categories when all belong to user', async () => {
    const categories = [
      Category.create('cat-1', 'user-1', 'Food', 'food', '#000', 'expense'),
      Category.create('cat-2', 'user-1', 'Transport', 'bus', '#111', 'expense'),
      Category.create('cat-3', 'user-1', 'Entertainment', 'movie', '#222', 'expense'),
    ];
    mockCategoryRepository.findByUserId.mockResolvedValue(categories);
    mockCategoryRepository.updateSortOrder.mockResolvedValue(undefined);

    const command = new ReorderCategoriesCommand('user-1', ['cat-3', 'cat-1', 'cat-2']);

    await handler.execute(command);

    expect(mockCategoryRepository.updateSortOrder).toHaveBeenCalledWith([
      'cat-3',
      'cat-1',
      'cat-2',
    ]);
  });

  it('should throw ForbiddenException if any category does not belong to user', async () => {
    const categories = [Category.create('cat-1', 'user-1', 'Food', 'food', '#000', 'expense')];
    mockCategoryRepository.findByUserId.mockResolvedValue(categories);

    // Trying to reorder with a category ID that doesn't belong to user
    const command = new ReorderCategoriesCommand('user-1', ['cat-1', 'cat-foreign']);

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    expect(mockCategoryRepository.updateSortOrder).not.toHaveBeenCalled();
  });

  it('should handle empty category list', async () => {
    mockCategoryRepository.findByUserId.mockResolvedValue([]);
    mockCategoryRepository.updateSortOrder.mockResolvedValue(undefined);

    const command = new ReorderCategoriesCommand('user-1', []);

    await handler.execute(command);

    expect(mockCategoryRepository.updateSortOrder).toHaveBeenCalledWith([]);
  });
});
