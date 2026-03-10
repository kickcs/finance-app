import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InitializeDefaultCategoriesCommand } from './initialize-default-categories.command';
import { Category } from '../../../domain/aggregates/category';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../../../domain/constants/default-categories';

@CommandHandler(InitializeDefaultCategoriesCommand)
export class InitializeDefaultCategoriesHandler implements ICommandHandler<InitializeDefaultCategoriesCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: InitializeDefaultCategoriesCommand) {
    // Check if user already has categories
    const existingCategories = await this.categoryRepository.findByUserId(command.userId);

    if (existingCategories.length > 0) {
      // Return existing categories
      return existingCategories.map((cat) => ({
        id: cat.id,
        userId: cat.userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        type: cat.typeValue,
        sortOrder: cat.sortOrder,
        isFrequent: cat.isFrequent,
        createdAt: cat.createdAt,
      }));
    }

    // Create all default categories
    const defaultCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
    const categoriesToCreate = defaultCategories.map((cat, index) =>
      Category.create(
        crypto.randomUUID(),
        command.userId,
        cat.name,
        cat.icon,
        cat.color,
        cat.type,
        index,
      ),
    );

    const savedCategories = await this.categoryRepository.saveMany(categoriesToCreate);

    return savedCategories.map((cat) => ({
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.typeValue,
      sortOrder: cat.sortOrder,
      isFrequent: cat.isFrequent,
      createdAt: cat.createdAt,
    }));
  }
}
