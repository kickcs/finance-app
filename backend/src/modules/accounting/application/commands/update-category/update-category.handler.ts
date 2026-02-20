import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateCategoryCommand } from './update-category.command';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<UpdateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: UpdateCategoryCommand) {
    const category = await this.categoryRepository.findById(command.id);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    category.update(command.data);

    const savedCategory = await this.categoryRepository.save(category);

    return {
      id: savedCategory.id,
      userId: savedCategory.userId,
      name: savedCategory.name,
      icon: savedCategory.icon,
      color: savedCategory.color,
      type: savedCategory.typeValue,
      sortOrder: savedCategory.sortOrder,
      createdAt: savedCategory.createdAt,
    };
  }
}
