export * from './register/register.command';
export * from './register/register.handler';
export * from './login/login.command';
export * from './login/login.handler';
export * from './login-anonymous/login-anonymous.command';
export * from './login-anonymous/login-anonymous.handler';
export * from './logout/logout.command';
export * from './logout/logout.handler';
export * from './refresh/refresh.command';
export * from './refresh/refresh.handler';
export * from './update-profile/update-profile.command';
export * from './update-profile/update-profile.handler';

import { RegisterHandler } from './register/register.handler';
import { LoginHandler } from './login/login.handler';
import { LoginAnonymousHandler } from './login-anonymous/login-anonymous.handler';
import { LogoutHandler } from './logout/logout.handler';
import { RefreshHandler } from './refresh/refresh.handler';
import { UpdateProfileHandler } from './update-profile/update-profile.handler';

export const CommandHandlers = [
  RegisterHandler,
  LoginHandler,
  LoginAnonymousHandler,
  LogoutHandler,
  RefreshHandler,
  UpdateProfileHandler,
];
