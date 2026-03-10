import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateCategoryCommand } from './create-category.command';
import { Category } from '../../../domain/aggregates/category';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(command: CreateCategoryCommand) {
    const category = Category.create(
      crypto.randomUUID(),
      command.userId,
      command.name,
      command.icon,
      command.color,
      command.type,
      command.sortOrder,
      command.isFrequent,
    );

    const savedCategory = await this.categoryRepository.save(category);

    return {
      id: savedCategory.id,
      userId: savedCategory.userId,
      name: savedCategory.name,
      icon: savedCategory.icon,
      color: savedCategory.color,
      type: savedCategory.typeValue,
      sortOrder: savedCategory.sortOrder,
      isFrequent: savedCategory.isFrequent,
      createdAt: savedCategory.createdAt,
    };
  }
}
