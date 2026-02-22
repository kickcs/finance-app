import { http } from '../http';
import type { Profile } from '../database.types';

// Response type from NestJS backend (camelCase)
interface ProfileResponse {
  id: string;
  name: string | null;
  email: string | null;
  currency: string;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
  createdAt: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
}

function transformProfile(profile: ProfileResponse): Profile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    currency: profile.currency,
    has_completed_onboarding: profile.hasCompletedOnboarding,
    default_account_id: profile.defaultAccountId,
    created_at: profile.createdAt,
    is_demo: profile.isDemo,
    demo_expires_at: profile.demoExpiresAt,
  };
}

export const profileApi = {
  async getById(_userId: string): Promise<Profile | null> {
    try {
      // Backend gets userId from JWT token
      const data = await http.get<ProfileResponse>('/profiles/me');
      return transformProfile(data);
    } catch {
      return null;
    }
  },

  async getOrCreate(_userId: string): Promise<Profile> {
    // Backend gets userId from JWT token
    const data = await http.post<ProfileResponse>('/profiles/get-or-create', {});
    return transformProfile(data);
  },

  async update(_userId: string, updates: Partial<Profile>): Promise<Profile> {
    // Backend gets userId from JWT token
    // Only send fields that UpdateProfileDto accepts
    const data = await http.patch<ProfileResponse>('/profiles/me', {
      name: updates.name,
      currency: updates.currency,
      hasCompletedOnboarding: updates.has_completed_onboarding,
      defaultAccountId: updates.default_account_id,
    });
    return transformProfile(data);
  },
};
