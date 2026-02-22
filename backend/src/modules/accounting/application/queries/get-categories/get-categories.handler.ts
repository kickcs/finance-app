import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetCategoriesQuery } from './get-categories.query';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';

@QueryHandler(GetCategoriesQuery)
export class GetCategoriesHandler implements IQueryHandler<GetCategoriesQuery> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
  ) {}

  async execute(query: GetCategoriesQuery) {
    const categories = query.type
      ? await this.categoryRepository.findByUserIdAndType(query.userId, query.type)
      : await this.categoryRepository.findByUserId(query.userId);

    return categories.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      type: c.typeValue,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt,
    }));
  }
}
