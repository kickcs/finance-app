import type { PushDevice } from '../aggregates/push-device';

export const PUSH_DEVICE_REPOSITORY = Symbol('PUSH_DEVICE_REPOSITORY');

export interface IPushDeviceRepository {
  upsertByUserAndToken(device: PushDevice): Promise<void>;
  findByUserId(userId: string): Promise<PushDevice[]>;
  removeByToken(userId: string, token: string): Promise<void>;
}
