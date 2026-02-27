export * from './get-people/get-people.query';
export * from './get-people/get-people.handler';

import { GetPeopleHandler } from './get-people/get-people.handler';

export const QueryHandlers = [GetPeopleHandler];
