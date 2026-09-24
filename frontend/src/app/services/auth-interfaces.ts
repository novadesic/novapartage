export interface UnifiedUser {
  sub: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  picture?: string;
  email_verified?: boolean;
  hasPassword?: boolean;
  // Renvoie par /oidc/me (et/ou backend) pour distinguer l'administrateur.
  isSuperadmin?: boolean;
}

export interface UnifiedAuthState {
  isAuthenticated: boolean;
  isEmailValidated: boolean;
  userEmail?: string;
  token?: string;
  userInfo?: UnifiedUser;
}

export interface UnifiedAuthConfig {
  endpoint: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
  useCookies: boolean;
  useServerValidation: boolean;
}













