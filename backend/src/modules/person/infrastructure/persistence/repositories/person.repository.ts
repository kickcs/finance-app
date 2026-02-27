import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../../../domain/aggregates/person';
import { IPersonRepository } from '../../../domain/repositories';
import { PersonOrmEntity } from '../typeorm/person.orm-entity';
import { PersonMapper } from '../mappers/person.mapper';

@Injectable()
export class PersonRepository implements IPersonRepository {
  constructor(
    @InjectRepository(PersonOrmEntity)
    private readonly ormRepository: Repository<PersonOrmEntity>,
  ) {}

  async findById(id: string): Promise<Person | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return PersonMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Person[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
    return ormEntities.map((entity) => PersonMapper.toDomain(entity));
  }

  async save(person: Person): Promise<Person> {
    const ormEntity = PersonMapper.toOrm(person);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return PersonMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }
}
