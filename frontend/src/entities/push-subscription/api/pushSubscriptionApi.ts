import { http } from '@/shared/api/http';

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
};
