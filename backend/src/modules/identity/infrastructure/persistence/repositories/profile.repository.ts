import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../../../domain';
import { IProfileRepository } from '../../../domain/repositories/profile.repository.interface';
import { ProfileOrmEntity } from '../typeorm/profile.orm-entity';
import { ProfileMapper } from '../mappers/profile.mapper';

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @InjectRepository(ProfileOrmEntity)
    private readonly ormRepository: Repository<ProfileOrmEntity>,
  ) {}

  async findById(id: string): Promise<Profile | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id },
    });

    if (!ormEntity) {
      return null;
    }

    return ProfileMapper.toDomain(ormEntity);
  }

  async findByEmail(email: string): Promise<Profile | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!ormEntity) {
      return null;
    }

    return ProfileMapper.toDomain(ormEntity);
  }

  async save(profile: Profile): Promise<Profile> {
    const ormEntity = ProfileMapper.toOrm(profile);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return ProfileMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({
      where: { id },
    });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.ormRepository.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }
}
