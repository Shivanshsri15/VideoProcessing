export type JwtPayload = {
  sub: string;
  email: string;
  jti: string;
  tv: number;
  iat?: number;
  exp?: number;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  tokenVersion: number;
  jti: string;
  exp?: number;
};
