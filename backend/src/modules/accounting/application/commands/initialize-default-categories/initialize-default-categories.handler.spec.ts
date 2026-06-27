import { Test, type TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { InitializeDefaultCategoriesHandler } from './initialize-default-categories.handler';
import { InitializeDefaultCategoriesCommand } from './initialize-default-categories.command';
import { CATEGORY_REPOSITORY } from '../../../domain/repositories/category.repository.interface';
import { PROFILE_REPOSITORY } from '../../../../identity/domain/repositories/profile.repository.interface';
import { Category } from '../../../domain/aggregates/category';

describe('InitializeDefaultCategoriesHandler', () => {
  let handler: InitializeDefaultCategoriesHandler;

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

  const mockProfileRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByEmail: jest.fn(),
  };

  const mockI18n = {
    translate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitializeDefaultCategoriesHandler,
        { provide: CATEGORY_REPOSITORY, useValue: mockCategoryRepository },
        { provide: PROFILE_REPOSITORY, useValue: mockProfileRepository },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    handler = module.get<InitializeDefaultCategoriesHandler>(InitializeDefaultCategoriesHandler);
    jest.clearAllMocks();
  });

  it('creates categories with names translated to the given language', async () => {
    mockCategoryRepository.findByUserId.mockResolvedValue([]);
    mockCategoryRepository.saveMany.mockImplementation((cats: Category[]) => Promise.resolve(cats));
    mockI18n.translate.mockImplementation((key: string) => `EN:${key}`);

    const command = new InitializeDefaultCategoriesCommand('user-1', 'en');
    await handler.execute(command);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const created = mockCategoryRepository.saveMany.mock.calls[0][0] as Category[];
    // groceries is the first expense category
    expect(created[0].name).toBe('EN:categories.groceries');
    expect(mockI18n.translate).toHaveBeenCalledWith('categories.groceries', { lang: 'en' });
  });

  it('falls back to profile language when command has no language', async () => {
    mockCategoryRepository.findByUserId.mockResolvedValue([]);
    mockCategoryRepository.saveMany.mockImplementation((cats: Category[]) => Promise.resolve(cats));
    mockProfileRepository.findById.mockResolvedValue({ language: 'en' });
    mockI18n.translate.mockImplementation((key: string) => `EN:${key}`);

    const command = new InitializeDefaultCategoriesCommand('user-1');
    await handler.execute(command);

    expect(mockProfileRepository.findById).toHaveBeenCalledWith('user-1');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const created = mockCategoryRepository.saveMany.mock.calls[0][0] as Category[];
    expect(created[0].name).toBe('EN:categories.groceries');
  });

  it('defaults to ru when profile has no language', async () => {
    mockCategoryRepository.findByUserId.mockResolvedValue([]);
    mockCategoryRepository.saveMany.mockImplementation((cats: Category[]) => Promise.resolve(cats));
    mockProfileRepository.findById.mockResolvedValue(null);
    mockI18n.translate.mockImplementation((key: string) => `RU:${key}`);

    const command = new InitializeDefaultCategoriesCommand('user-1');
    await handler.execute(command);

    expect(mockI18n.translate).toHaveBeenCalledWith('categories.groceries', { lang: 'ru' });
  });

  it('returns existing categories without creating new ones', async () => {
    const existing = [
      Category.create('cat-1', 'user-1', 'Продукты', 'shopping_basket', '#10b981', 'expense', 0),
    ];
    mockCategoryRepository.findByUserId.mockResolvedValue(existing);

    const command = new InitializeDefaultCategoriesCommand('user-1', 'en');
    const result = await handler.execute(command);

    expect(mockCategoryRepository.saveMany).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
