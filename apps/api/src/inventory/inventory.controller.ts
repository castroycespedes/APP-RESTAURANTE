import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { CreateInventoryPurchaseDto } from './dto/create-inventory-purchase.dto';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InventoryService } from './inventory.service';

const INVENTORY_OPERATORS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY];

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...INVENTORY_OPERATORS)
@Permissions('inventory:read')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('units')
  findUnits() {
    return this.inventoryService.findUnits();
  }

  @Post('units')
  @Permissions('inventory:manage')
  createUnit(@Body() dto: CreateMeasurementUnitDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createUnit(dto, user.id);
  }

  @Patch('units/:id')
  @Permissions('inventory:manage')
  updateUnit(@Param('id') id: string, @Body() dto: UpdateMeasurementUnitDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateUnit(id, dto, user.id);
  }

  @Get('suppliers')
  findSuppliers() {
    return this.inventoryService.findSuppliers();
  }

  @Post('suppliers')
  @Permissions('inventory:manage')
  createSupplier(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createSupplier(dto, user.id);
  }

  @Patch('suppliers/:id')
  @Permissions('inventory:manage')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateSupplier(id, dto, user.id);
  }

  @Delete('suppliers/:id')
  @Permissions('inventory:manage')
  deactivateSupplier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deactivateSupplier(id, user.id);
  }

  @Get('ingredients')
  findIngredients() {
    return this.inventoryService.findIngredients();
  }

  @Get('ingredients/low-stock')
  findLowStockIngredients() {
    return this.inventoryService.findLowStockIngredients();
  }

  @Post('ingredients')
  @Permissions('inventory:manage')
  createIngredient(@Body() dto: CreateIngredientDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createIngredient(dto, user.id);
  }

  @Patch('ingredients/:id')
  @Permissions('inventory:manage')
  updateIngredient(@Param('id') id: string, @Body() dto: UpdateIngredientDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateIngredient(id, dto, user.id);
  }

  @Delete('ingredients/:id')
  @Permissions('inventory:manage')
  deactivateIngredient(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deactivateIngredient(id, user.id);
  }

  @Get('recipes')
  findRecipes(@Query('menuItemId') menuItemId?: string) {
    return this.inventoryService.findRecipes(menuItemId);
  }

  @Post('recipes')
  @Permissions('inventory:manage')
  createRecipe(@Body() dto: CreateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createRecipe(dto, user.id);
  }

  @Patch('recipes/:id')
  @Permissions('inventory:manage')
  updateRecipe(@Param('id') id: string, @Body() dto: UpdateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateRecipe(id, dto, user.id);
  }

  @Delete('recipes/:id')
  @Permissions('inventory:manage')
  deactivateRecipe(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deactivateRecipe(id, user.id);
  }

  @Get('recipes/menu-items/:menuItemId/cost')
  estimateMenuItemCost(@Param('menuItemId') menuItemId: string) {
    return this.inventoryService.estimateMenuItemCost(menuItemId);
  }

  @Get('movements')
  findMovements() {
    return this.inventoryService.findMovements();
  }

  @Get('purchases')
  findPurchases() {
    return this.inventoryService.findPurchases();
  }

  @Post('purchases')
  @Permissions('inventory:manage')
  createPurchase(@Body() dto: CreateInventoryPurchaseDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createPurchase(dto, user.id);
  }

  @Get('counts')
  findCounts() {
    return this.inventoryService.findCounts();
  }

  @Post('counts')
  @Permissions('inventory:manage')
  createCount(@Body() dto: CreateInventoryCountDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createCount(dto, user.id);
  }

  @Post('movements')
  @Permissions('inventory:manage')
  createMovement(@Body() dto: CreateInventoryMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createMovement(dto, user.id);
  }
}
