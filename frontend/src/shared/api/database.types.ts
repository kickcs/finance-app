export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Keep in sync with backend: backend/src/modules/identity/domain/entities/profile.entity.ts */
export type WidgetId =
  | 'quick_actions'
  | 'accounts'
  | 'top_expenses'
  | 'transactions'
  | 'debts'
  | 'reminders';

export interface DashboardSettings {
  widget_order: WidgetId[];
  hidden_widgets: WidgetId[];
  hidden_account_ids: string[];
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          currency: string;
          has_completed_onboarding: boolean;
          default_account_id: string | null;
          created_at: string;
          is_demo: boolean;
          demo_expires_at: string | null;
          dashboard_settings: DashboardSettings | null;
          quick_actions_hidden: boolean;
          quick_actions_hint_dismissed: boolean;
        };
        Insert: {
          id: string;
          name?: string | null;
          email?: string | null;
          currency?: string;
          has_completed_onboarding?: boolean;
          default_account_id?: string | null;
          created_at?: string;
          is_demo?: boolean;
          demo_expires_at?: string | null;
          dashboard_settings?: DashboardSettings | null;
          quick_actions_hidden?: boolean;
          quick_actions_hint_dismissed?: boolean;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string | null;
          currency?: string;
          has_completed_onboarding?: boolean;
          default_account_id?: string | null;
          created_at?: string;
          is_demo?: boolean;
          demo_expires_at?: string | null;
          dashboard_settings?: DashboardSettings | null;
          quick_actions_hidden?: boolean;
          quick_actions_hint_dismissed?: boolean;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          balance: number;
          currency: string;
          icon: string;
          color: string;
          type: 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit';
          order: number;
          created_at: string;
          credit_limit: number | null;
          grace_period_days: number | null;
          billing_day: number | null;
          total_amount: number | null;
          interest_rate: number | null;
          monthly_payment: number | null;
          start_date: string | null;
          end_date: string | null;
          maturity_date: string | null;
          is_replenishable: boolean | null;
          is_withdrawable: boolean | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          balance?: number;
          currency: string;
          icon: string;
          color: string;
          type?: 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit';
          order?: number;
          created_at?: string;
          credit_limit?: number | null;
          grace_period_days?: number | null;
          billing_day?: number | null;
          total_amount?: number | null;
          interest_rate?: number | null;
          monthly_payment?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          maturity_date?: string | null;
          is_replenishable?: boolean | null;
          is_withdrawable?: boolean | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          balance?: number;
          currency?: string;
          icon?: string;
          color?: string;
          type?: 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit';
          order?: number;
          created_at?: string;
          credit_limit?: number | null;
          grace_period_days?: number | null;
          billing_day?: number | null;
          total_amount?: number | null;
          interest_rate?: number | null;
          monthly_payment?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          maturity_date?: string | null;
          is_replenishable?: boolean | null;
          is_withdrawable?: boolean | null;
        };
        Relationships: [];
      };
      account_balances: {
        Row: {
          id: string;
          account_id: string;
          currency: string;
          balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          currency: string;
          balance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          currency?: string;
          balance?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          base_currency: string;
          target_currency: string;
          rate: number;
          updated_at: string;
        };
        Insert: {
          base_currency: string;
          target_currency: string;
          rate: number;
          updated_at?: string;
        };
        Update: {
          base_currency?: string;
          target_currency?: string;
          rate?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string;
          amount: number;
          currency: string;
          type: 'income' | 'expense' | 'transfer' | 'adjustment';
          description: string | null;
          date: string;
          created_at: string;
          is_debt_related: boolean;
          debt_id: string | null;
          to_account_id: string | null;
          to_amount: number | null;
          to_currency: string | null;
          returned_amount: number;
          net_amount: number;
          has_debt_returns: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          category_id: string;
          amount: number;
          currency: string;
          type: 'income' | 'expense' | 'transfer' | 'adjustment';
          description?: string | null;
          date: string;
          created_at?: string;
          is_debt_related?: boolean;
          debt_id?: string | null;
          to_account_id?: string | null;
          to_amount?: number | null;
          to_currency?: string | null;
          fee_amount?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          category_id?: string;
          amount?: number;
          currency?: string;
          type?: 'income' | 'expense' | 'transfer' | 'adjustment';
          description?: string | null;
          date?: string;
          created_at?: string;
          is_debt_related?: boolean;
          debt_id?: string | null;
          to_account_id?: string | null;
          to_amount?: number | null;
          to_currency?: string | null;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount: number;
          deadline: string | null;
          icon: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount?: number;
          deadline?: string | null;
          icon: string;
          color: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_amount?: number;
          current_amount?: number;
          deadline?: string | null;
          icon?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      debts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          total_amount: number;
          remaining_amount: number;
          monthly_payment: number | null;
          next_payment_date: string | null;
          created_at: string;
          debt_type: 'given' | 'taken';
          person_name: string | null;
          account_id: string | null;
          transaction_id: string | null;
          close_transaction_id: string | null;
          is_closed: boolean;
          currency: string;
          source_transaction_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          total_amount: number;
          remaining_amount: number;
          monthly_payment?: number | null;
          next_payment_date?: string | null;
          created_at?: string;
          debt_type?: 'given' | 'taken';
          person_name?: string | null;
          account_id?: string | null;
          transaction_id?: string | null;
          close_transaction_id?: string | null;
          is_closed?: boolean;
          currency?: string;
          source_transaction_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          total_amount?: number;
          remaining_amount?: number;
          monthly_payment?: number | null;
          next_payment_date?: string | null;
          created_at?: string;
          debt_type?: 'given' | 'taken';
          person_name?: string | null;
          account_id?: string | null;
          transaction_id?: string | null;
          close_transaction_id?: string | null;
          is_closed?: boolean;
          currency?: string;
          source_transaction_id?: string | null;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          frequency: 'weekly' | 'monthly' | 'yearly' | 'once';
          next_date: string;
          icon: string;
          color: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          amount: number;
          frequency: 'weekly' | 'monthly' | 'yearly' | 'once';
          next_date: string;
          icon: string;
          color: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          amount?: number;
          frequency?: 'weekly' | 'monthly' | 'yearly' | 'once';
          next_date?: string;
          icon?: string;
          color?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          theme: 'light' | 'dark' | 'system';
          language: string;
          notifications_enabled: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: 'light' | 'dark' | 'system';
          language?: string;
          notifications_enabled?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: 'light' | 'dark' | 'system';
          language?: string;
          notifications_enabled?: boolean;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          color: string;
          type: 'expense' | 'income';
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon: string;
          color: string;
          type: 'expense' | 'income';
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          icon?: string;
          color?: string;
          type?: 'expense' | 'income';
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      quick_actions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          account_id: string;
          label: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          account_id: string;
          label: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          account_id?: string;
          label?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_account_balance: {
        Args: {
          p_account_id: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      get_monthly_stats: {
        Args: {
          p_user_id: string;
          p_year: number;
          p_month: number;
        };
        Returns: {
          total_income: number;
          total_expense: number;
          income_by_currency: Record<string, number>;
          expense_by_currency: Record<string, number>;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type AccountBalance = Database['public']['Tables']['account_balances']['Row'];
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type Debt = Database['public']['Tables']['debts']['Row'];
export type Reminder = Database['public']['Tables']['reminders']['Row'];
export type Settings = Database['public']['Tables']['settings']['Row'];

export type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
export type AccountBalanceInsert = Database['public']['Tables']['account_balances']['Insert'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type GoalInsert = Database['public']['Tables']['goals']['Insert'];
export type DebtInsert = Database['public']['Tables']['debts']['Insert'];
export type ReminderInsert = Database['public']['Tables']['reminders']['Insert'];
export type UserCategory = Database['public']['Tables']['categories']['Row'];
export type UserCategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type QuickAction = Database['public']['Tables']['quick_actions']['Row'];
export type QuickActionInsert = Database['public']['Tables']['quick_actions']['Insert'];

// Extended types for multi-currency accounts
export interface AccountWithBalances extends Omit<Account, 'balance' | 'currency'> {
  balances: AccountBalance[];
}
