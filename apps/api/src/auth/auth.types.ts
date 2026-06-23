import type { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  roleId: string;
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  roleId: string;
  permissions: string[];
}

export interface RequestWithUser {
  user?: AuthUser;
  headers: {
    authorization?: string;
  };
}
