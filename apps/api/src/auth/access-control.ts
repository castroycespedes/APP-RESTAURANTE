import { UserRole } from '@prisma/client';

export const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;
export const ADMIN_PANEL_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] as const;
export const KITCHEN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN] as const;
export const CASHIER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

export function hasRequiredRole(userRole: UserRole | undefined, requiredRoles: readonly UserRole[]) {
  if (requiredRoles.length === 0) {
    return true;
  }

  return Boolean(userRole && requiredRoles.includes(userRole));
}

export function hasRequiredPermissions(userPermissions: readonly string[] | undefined, requiredPermissions: readonly string[]) {
  if (requiredPermissions.length === 0) {
    return true;
  }

  const grants = new Set(userPermissions ?? []);

  return Boolean(
    grants.has('*') ||
      requiredPermissions.every((permission) => {
        const [scope] = permission.split(':');

        return grants.has(permission) || grants.has(`${scope}:manage`);
      })
  );
}
