import type { DashboardSettings } from '../../domain/entities/profile.entity';

export interface ProfileResponse {
  id: string;
  email: string | null;
  name: string | null;
  currency: string;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
  isDemo: boolean;
  demoExpiresAt: Date | null;
  dashboardSettings: DashboardSettings | null;
  quickActionsHidden: boolean;
  quickActionsHintDismissed: boolean;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  isAnonymous: boolean;
  isDemo: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    isAnonymous: boolean;
    isDemo: boolean;
  };
  tokens: AuthTokens;
}
