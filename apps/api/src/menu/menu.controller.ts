import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemModifierDto } from './dto/create-menu-item-modifier.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemModifierDto } from './dto/update-menu-item-modifier.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuService } from './menu.service';

const MENU_MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER];
const MENU_VIEWERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER
];

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('available')
  @Roles(...MENU_VIEWERS)
  @Permissions('menu:read')
  findAvailable() {
    return this.menuService.findAvailable();
  }

  @Get('public')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  findPublicMenu(@Query('showSoldOut') showSoldOut?: string) {
    return this.menuService.findPublicMenu(showSoldOut === 'true');
  }

  @Get('categories')
  @Roles(...MENU_VIEWERS)
  @Permissions('menu:read')
  findAllCategories() {
    return this.menuService.findAllCategories();
  }

  @Get('categories/:categoryId/subcategories')
  @Roles(...MENU_VIEWERS)
  @Permissions('menu:read')
  findSubcategories(@Param('categoryId') categoryId: string) {
    return this.menuService.findActiveSubcategories(categoryId);
  }

  @Get('items/by-category/:categoryId')
  @Roles(...MENU_VIEWERS)
  @Permissions('menu:read')
  findItemsByCategory(@Param('categoryId') categoryId: string) {
    return this.menuService.findAvailableItemsByCategory(categoryId);
  }

  @Get('items/by-subcategory/:subcategoryId')
  @Roles(...MENU_VIEWERS)
  @Permissions('menu:read')
  findItemsBySubcategory(@Param('subcategoryId') subcategoryId: string) {
    return this.menuService.findAvailableItemsByCategory(subcategoryId);
  }

  @Get('items/:id/applicable-modifiers')
  @Roles(...MENU_VIEWERS)
  @Permissions('menu:read')
  findApplicableModifiers(@Param('id') id: string) {
    return this.menuService.findApplicableModifiers(id);
  }

  @Post('categories')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  createCategory(@Body() dto: CreateMenuCategoryDto, @CurrentUser() actor: AuthUser) {
    return this.menuService.createCategory(dto, actor.id);
  }

  @Patch('categories/:id')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
    @CurrentUser() actor: AuthUser
  ) {
    return this.menuService.updateCategory(id, dto, actor.id);
  }

  @Delete('categories/:id')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  deactivateCategory(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.menuService.deactivateCategory(id, actor.id);
  }

  @Get('items')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  findAllItems() {
    return this.menuService.findAllItems();
  }

  @Post('items')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  createItem(@Body() dto: CreateMenuItemDto, @CurrentUser() actor: AuthUser) {
    return this.menuService.createItem(dto, actor.id);
  }

  @Patch('items/:id')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto, @CurrentUser() actor: AuthUser) {
    return this.menuService.updateItem(id, dto, actor.id);
  }

  @Patch('items/:id/availability')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  updateItemAvailability(
    @Param('id') id: string,
    @Body() dto: Pick<UpdateMenuItemDto, 'isAvailable'>,
    @CurrentUser() actor: AuthUser
  ) {
    return this.menuService.updateItem(id, { isAvailable: dto.isAvailable }, actor.id);
  }

  @Delete('items/:id')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  deactivateItem(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.menuService.deactivateItem(id, actor.id);
  }

  @Get('modifiers')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  findAllModifiers() {
    return this.menuService.findAllModifiers();
  }

  @Post('modifiers')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  createModifier(@Body() dto: CreateMenuItemModifierDto, @CurrentUser() actor: AuthUser) {
    return this.menuService.createModifier(dto, actor.id);
  }

  @Patch('modifiers/:id')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  updateModifier(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemModifierDto,
    @CurrentUser() actor: AuthUser
  ) {
    return this.menuService.updateModifier(id, dto, actor.id);
  }

  @Delete('modifiers/:id')
  @Roles(...MENU_MANAGERS)
  @Permissions('menu:manage')
  deactivateModifier(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.menuService.deactivateModifier(id, actor.id);
  }
}
