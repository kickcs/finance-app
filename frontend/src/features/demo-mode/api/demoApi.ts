import { profileApi } from '@/shared/api/services/profileApi'

/**
 * Demo mode API utilities
 *
 * Note: Demo data initialization is now handled entirely by the backend
 * when the user calls signInAnonymously(). This ensures:
 * - Atomic creation of all demo data
 * - No network failures during partial initialization
 * - Consistent timestamp between profile expiry and tokens
 * - Server-side rate limiting protection
 */
export const demoApi = {
  /**
   * Check if a demo account has expired
   */
  async isDemoExpired(userId: string): Promise<boolean> {
    const profile = await profileApi.getById(userId)

    if (!profile?.is_demo || !profile.demo_expires_at) {
      return false
    }

    return new Date(profile.demo_expires_at) < new Date()
  },

  /**
   * Get demo expiration time
   */
  async getDemoExpiresAt(userId: string): Promise<string | null> {
    const profile = await profileApi.getById(userId)
    return profile?.demo_expires_at ?? null
  },
}
