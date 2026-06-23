import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MenuService } from './menu.service';

const MENU_ITEM_VIEWERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN
];

@Controller('menu-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuItemsController {
  constructor(private readonly menuService: MenuService) {}

  @Get('available')
  @Roles(...MENU_ITEM_VIEWERS)
  @Permissions('menu:read')
  async findAvailableItems() {
    const products = await this.menuService.findAvailable();

    return {
      data: products,
      message: products.length > 0 ? 'Productos disponibles cargados correctamente.' : 'No hay productos disponibles para vender.'
    };
  }
}
