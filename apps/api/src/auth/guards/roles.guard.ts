import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { hasRequiredPermissions, hasRequiredRole } from '../access-control';
import type { RequestWithUser } from '../auth.types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!hasRequiredRole(request.user?.role, requiredRoles)) {
      throw new ForbiddenException('No tienes permiso para acceder a esta funcion.');
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (!hasRequiredPermissions(request.user?.permissions, requiredPermissions)) {
      throw new ForbiddenException('No tienes el permiso necesario para realizar esta accion.');
    }

    return true;
  }
}
