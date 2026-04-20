export type OrdnaryUser = {
  sub: string;
  name?: string | null;
  email?: string | null;
  email_verified?: boolean;
  picture?: string | null;
  locale?: string | null;
  [key: string]: unknown;
};

export type OrdnaryAuthSession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: number;
  user: OrdnaryUser;
};

export type OrdnaryLoginState = {
  state: string;
  codeVerifier: string;
  nonce: string;
  returnTo: string;
};

export type CreateOrdnaryAuthConfig = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  cookieSecret: string;
  cookiePrefix?: string;
  scopes?: string | string[];
  defaultReturnTo?: string;
  failureRedirectTo?: string;
  logoutRedirectTo?: string;
  secureCookies?: boolean;
};

export type HandleLoginOptions = {
  returnTo?: string;
  returnToParam?: string;
  scope?: string | string[];
  prompt?: string;
};

export type HandleCallbackOptions = {
  failureRedirectTo?: string;
};

export type HandleLogoutOptions = {
  redirectTo?: string;
};

export type OrdnaryAuthClient = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
  createRandomString: (size?: number) => string;
  createPkcePair: () => Promise<{ verifier: string; challenge: string }>;
  buildAuthorizeUrl: (params: Record<string, string | number | undefined | null>) => URL;
  readSession: () => Promise<OrdnaryAuthSession | null>;
  writeSession: (session: OrdnaryAuthSession) => Promise<OrdnaryAuthSession>;
  clearSession: () => Promise<void>;
  readLoginState: () => Promise<OrdnaryLoginState | null>;
  writeLoginState: (state: OrdnaryLoginState) => Promise<OrdnaryLoginState>;
  clearLoginState: () => Promise<void>;
  exchangeCode: (input: {
    code: string;
    codeVerifier: string;
  }) => Promise<Record<string, unknown>>;
  fetchUserInfo: (accessToken: string) => Promise<OrdnaryUser>;
  handleLogin: (request: Request, options?: HandleLoginOptions) => Promise<Response>;
  handleCallback: (request: Request, options?: HandleCallbackOptions) => Promise<Response>;
  handleLogout: (request: Request, options?: HandleLogoutOptions) => Promise<Response>;
  requireSession: (path?: string) => Promise<OrdnaryAuthSession>;
};

export function createOrdnaryAuth(config: CreateOrdnaryAuthConfig): OrdnaryAuthClient;
