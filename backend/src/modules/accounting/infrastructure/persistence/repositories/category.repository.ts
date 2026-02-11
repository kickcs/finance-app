import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../../domain/aggregates/category';
import { ICategoryRepository } from '../../../domain/repositories/category.repository.interface';
import { CategoryOrmEntity } from '../typeorm/category.orm-entity';
import { CategoryMapper } from '../mappers/category.mapper';

@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    @InjectRepository(CategoryOrmEntity)
    private readonly ormRepository: Repository<CategoryOrmEntity>,
  ) {}

  async findById(id: string): Promise<Category | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });

    if (!ormEntity) {
      return null;
    }

    return CategoryMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return ormEntities.map((entity) => CategoryMapper.toDomain(entity));
  }

  async findByUserIdAndType(userId: string, type: string): Promise<Category[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId, type },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return ormEntities.map((entity) => CategoryMapper.toDomain(entity));
  }

  async save(category: Category): Promise<Category> {
    const ormEntity = CategoryMapper.toOrm(category);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return CategoryMapper.toDomain(savedEntity);
  }

  async saveMany(categories: Category[]): Promise<Category[]> {
    const ormEntities = categories.map((category) =>
      CategoryMapper.toOrm(category),
    );
    const savedEntities = await this.ormRepository.save(ormEntities);
    return savedEntities.map((entity) => CategoryMapper.toDomain(entity));
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }

  async updateSortOrder(categoryIds: string[]): Promise<void> {
    await Promise.all(
      categoryIds.map((id, index) =>
        this.ormRepository.update(id, { sortOrder: index }),
      ),
    );
  }
}
