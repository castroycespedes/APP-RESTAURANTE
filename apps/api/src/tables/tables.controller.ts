import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignWaiterDto } from './dto/assign-waiter.dto';
import { AutoArrangeTablesDto } from './dto/auto-arrange-tables.dto';
import { CreateDiningAreaDto } from './dto/create-dining-area.dto';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { MoveTableDto } from './dto/move-table.dto';
import { UpdateDiningAreaDto } from './dto/update-dining-area.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { TablesService } from './tables.service';

const TABLE_MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER];
const TABLE_VIEWERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER];

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get('dining-areas')
  @Roles(...TABLE_VIEWERS)
  @Permissions('tables:read')
  findAreas() {
    return this.tablesService.findAreas();
  }

  @Post('dining-areas')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  createArea(@Body() dto: CreateDiningAreaDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.createArea(dto, actor.id);
  }

  @Patch('dining-areas/:id')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  updateArea(@Param('id') id: string, @Body() dto: UpdateDiningAreaDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.updateArea(id, dto, actor.id);
  }

  @Delete('dining-areas/:id')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  deactivateArea(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.tablesService.deactivateArea(id, actor.id);
  }

  @Get('tables')
  @Roles(...TABLE_VIEWERS)
  @Permissions('tables:read')
  findTables(@CurrentUser() user: AuthUser) {
    return this.tablesService.findTablesForUser(user);
  }

  @Get('tables/by-area/:areaId')
  @Roles(...TABLE_VIEWERS)
  @Permissions('tables:read')
  findTablesByArea(@Param('areaId') areaId: string, @CurrentUser() user: AuthUser) {
    return this.tablesService.findTablesByArea(areaId, user);
  }

  @Get('tables/my-tables')
  @Roles(UserRole.WAITER)
  @Permissions('tables:read')
  findMyTables(@CurrentUser() waiter: AuthUser) {
    return this.tablesService.findMyTables(waiter.id);
  }

  @Get('waiter/tables')
  @Roles(...TABLE_VIEWERS)
  @Permissions('tables:read')
  findWaiterOperationalTables(@CurrentUser() user: AuthUser) {
    return this.tablesService.findWaiterOperationalTables(user);
  }

  @Get('tables/:tableId/current-order')
  @Roles(...TABLE_VIEWERS)
  @Permissions('orders:read')
  findCurrentOrderForTable(@Param('tableId') tableId: string, @CurrentUser() user: AuthUser) {
    return this.tablesService.findCurrentOrderForTable(tableId, user);
  }

  @Post('tables')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  createTable(@Body() dto: CreateRestaurantTableDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.createTable(dto, actor.id);
  }

  @Patch('tables/auto-arrange')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  autoArrangeTables(@Body() dto: AutoArrangeTablesDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.autoArrangeTables(dto, actor.id);
  }

  @Patch('tables/:id/status')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  updateTableStatus(@Param('id') id: string, @Body() dto: UpdateTableStatusDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.updateTableStatus(id, dto, actor.id);
  }

  @Patch('tables/:id/mark-available')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  markAvailable(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.tablesService.markTableAvailable(id, actor.id);
  }

  @Patch('tables/:id/block')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  blockTable(@Param('id') id: string, @Body() dto: { reason?: string }, @CurrentUser() actor: AuthUser) {
    return this.tablesService.blockTable(id, actor.id, dto.reason);
  }

  @Patch('tables/:id')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  updateTable(@Param('id') id: string, @Body() dto: UpdateRestaurantTableDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.updateTable(id, dto, actor.id);
  }

  @Patch('tables/:id/move')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  moveTable(@Param('id') id: string, @Body() dto: MoveTableDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.moveTable(id, dto, actor.id);
  }

  @Patch('tables/:id/position')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  updateTablePosition(@Param('id') id: string, @Body() dto: MoveTableDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.moveTable(id, dto, actor.id);
  }

  @Patch('tables/:id/assign-waiter')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  assignWaiter(@Param('id') id: string, @Body() dto: AssignWaiterDto, @CurrentUser() actor: AuthUser) {
    return this.tablesService.assignWaiter(id, dto.waiterId, actor.id);
  }

  @Delete('tables/:id')
  @Roles(...TABLE_MANAGERS)
  @Permissions('tables:manage')
  deactivateTable(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.tablesService.deactivateTable(id, actor.id);
  }

  @Post('tables/:id/open-order')
  @Roles(UserRole.WAITER)
  @Permissions('orders:create')
  openOrder(@Param('id') id: string, @CurrentUser() waiter: AuthUser) {
    return this.tablesService.openOrderForAssignedTable(id, waiter.id);
  }
}
