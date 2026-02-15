import type { Profile } from '../entities/profile.entity';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

/**
 * Profile Repository Interface
 */
export interface IProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findByEmail(email: string): Promise<Profile | null>;
  save(profile: Profile): Promise<Profile>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  existsByEmail(email: string): Promise<boolean>;
}
