import { http } from '@/shared/api/http';
import type { NotificationPreferences } from '../model/types';

interface RegisterResponse {
  id: string;
}

export const pushSubscriptionApi = {
  async register(data: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<RegisterResponse> {
    return http.post<RegisterResponse>('/push-subscriptions', data);
  },
  async unregister(id: string): Promise<void> {
    await http.delete(`/push-subscriptions/${id}`);
  },
  async sendTest(): Promise<void> {
    await http.post('/push-subscriptions/test');
  },
  async getPreferences(): Promise<NotificationPreferences> {
    return http.get<NotificationPreferences>('/push-subscriptions/preferences');
  },
  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    await http.patch('/push-subscriptions/preferences', prefs);
  },
};
