export type SplitMethod = 'equal' | 'custom'

export interface SplitParticipant {
  id: string
  personName: string
  amount: number
}

export interface SplitExpenseData {
  enabled: boolean
  method: SplitMethod
  myShare: number
  participants: SplitParticipant[]
}

export const initialSplitData: SplitExpenseData = {
  enabled: false,
  method: 'equal',
  myShare: 0,
  participants: [],
}
