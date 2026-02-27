export type SplitMethod = 'equal' | 'custom';

export interface SplitParticipant {
  id: string;
  personName: string;
  amount: number;
  fromContacts?: boolean;
  personColor?: string;
}

export interface SplitExpenseData {
  enabled: boolean;
  method: SplitMethod;
  isIncluded: boolean;
  myShare: number;
  participants: SplitParticipant[];
}

export const initialSplitData: SplitExpenseData = {
  enabled: false,
  method: 'equal',
  isIncluded: true,
  myShare: 0,
  participants: [],
};
