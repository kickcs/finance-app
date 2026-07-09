/** Сохранённые реквизиты «куда переводить» (карта, телефон и т.п.) */
export interface PaymentMethod {
  id: string;
  user_id: string;
  label: string;
  value: string;
  created_at: string;
}

export interface PaymentMethodInsert {
  label: string;
  value: string;
}
