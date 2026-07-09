import { http } from '@/shared/api/http';
import type { PaymentMethod, PaymentMethodInsert } from '../model/types';

// Response type from NestJS backend (camelCase)
interface PaymentMethodResponse {
  id: string;
  userId: string;
  label: string;
  value: string;
  createdAt: string;
}

function transformPaymentMethod(method: PaymentMethodResponse): PaymentMethod {
  return {
    id: method.id,
    user_id: method.userId,
    label: method.label,
    value: method.value,
    created_at: method.createdAt,
  };
}

export const paymentMethodApi = {
  async getAll(): Promise<PaymentMethod[]> {
    const data = await http.get<PaymentMethodResponse[]>('/payment-methods');
    return data.map(transformPaymentMethod);
  },

  async create(method: PaymentMethodInsert): Promise<PaymentMethod> {
    const data = await http.post<PaymentMethodResponse>('/payment-methods', {
      label: method.label,
      value: method.value,
    });
    return transformPaymentMethod(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/payment-methods/${id}`);
  },
};
