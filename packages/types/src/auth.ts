export type Role =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'waiter'
  | 'kitchen'
  | 'inventory';

export type Permission =
  | 'orders:create'
  | 'orders:read'
  | 'orders:update-status'
  | 'orders:cancel'
  | 'tables:read'
  | 'tables:update-status'
  | 'menu:read'
  | 'menu:manage'
  | 'payments:create'
  | 'payments:refund'
  | 'kitchen:read'
  | 'kitchen:update-status'
  | 'users:manage'
  | 'reports:read'
  | 'inventory:read'
  | 'inventory:manage'
  | 'settings:manage';

export interface AuthenticatedUser {
  id: string;
  restaurantId: string;
  role: Role;
  permissions: Permission[];
}
