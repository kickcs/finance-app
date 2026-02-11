export * from './get-profile/get-profile.query';
export * from './get-profile/get-profile.handler';

import { GetProfileHandler } from './get-profile/get-profile.handler';

export const QueryHandlers = [GetProfileHandler];
