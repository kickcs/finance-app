import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ForbiddenException, Inject } from '@nestjs/common';
import { ReorderCategoriesCommand } from './reorder-categories.command';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';

@CommandHandler(ReorderCategoriesCommand)
export class ReorderCategoriesHandler implements ICommandHandler<ReorderCategoriesCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: ReorderCategoriesCommand): Promise<void> {
    // Verify all category IDs belong to the requesting user
    const userCategories = await this.categoryRepository.findByUserId(command.userId);
    const userCategoryIds = new Set(userCategories.map((c) => c.id));

    for (const id of command.categoryIds) {
      if (!userCategoryIds.has(id)) {
        throw new ForbiddenException('Access denied');
      }
    }

    await this.categoryRepository.updateSortOrder(command.categoryIds);
  }
}
