export * from './create-person/create-person.command';
export * from './create-person/create-person.handler';
export * from './update-person/update-person.command';
export * from './update-person/update-person.handler';
export * from './delete-person/delete-person.command';
export * from './delete-person/delete-person.handler';

import { CreatePersonHandler } from './create-person/create-person.handler';
import { UpdatePersonHandler } from './update-person/update-person.handler';
import { DeletePersonHandler } from './delete-person/delete-person.handler';

export const CommandHandlers = [CreatePersonHandler, UpdatePersonHandler, DeletePersonHandler];
