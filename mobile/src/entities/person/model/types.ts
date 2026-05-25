export interface Person {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export type PersonInsert = Pick<Person, 'name'> & { color?: string };
