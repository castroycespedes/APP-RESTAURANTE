import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OpenOrderDto } from './dto/open-order.dto';
import { OpenTableOrderDto } from './dto/open-table-order.dto';
import { RemoveOrderItemDto } from './dto/remove-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrdersService } from './orders.service';

const ORDER_OPERATORS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER];

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('open-table')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:create')
  async openTableOrder(@Body() dto: OpenTableOrderDto, @CurrentUser() waiter: AuthUser) {
    const { tableId, ...orderDto } = dto;
    const order = await this.ordersService.openOrder(tableId, waiter, orderDto);

    return {
      data: {
        order,
        table: order.table
      },
      message: 'Pedido creado correctamente.'
    };
  }

  @Post('tables/:tableId/open')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:create')
  openOrder(@Param('tableId') tableId: string, @Body() dto: OpenOrderDto, @CurrentUser() waiter: AuthUser) {
    return this.ordersService.openOrder(tableId, waiter, dto);
  }

  @Get('open-by-table/:tableId')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:read')
  findOpenOrderByTableAlias(@Param('tableId') tableId: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOpenOrderByTable(tableId, user);
  }

  @Get('tables/:tableId/open')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:read')
  findOpenOrderByTable(@Param('tableId') tableId: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOpenOrderByTable(tableId, user);
  }

  @Get('my')
  @Roles(UserRole.WAITER)
  @Permissions('orders:read')
  findMyOrders(@CurrentUser() waiter: AuthUser) {
    return this.ordersService.findOrdersForWaiter(waiter.id);
  }

  @Post(':orderId/items')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:create')
  addItem(@Param('orderId') orderId: string, @Body() dto: AddOrderItemDto, @CurrentUser() waiter: AuthUser) {
    return this.ordersService.addItem(orderId, dto, waiter);
  }

  @Patch(':orderId/items/:itemId')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  updateItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.ordersService.updateItem(orderId, itemId, dto, user);
  }

  @Delete(':orderId/items/:itemId')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  removeItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RemoveOrderItemDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.ordersService.removeItem(orderId, itemId, dto, user);
  }

  @Post(':orderId/send-to-kitchen')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  sendToKitchen(@Param('orderId') orderId: string, @CurrentUser() waiter: AuthUser) {
    return this.ordersService.sendPendingItemsToKitchen(orderId, waiter);
  }

  @Post(':orderId/request-payment')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  requestPayment(@Param('orderId') orderId: string, @CurrentUser() waiter: AuthUser) {
    return this.ordersService.requestPayment(orderId, waiter);
  }

  @Patch(':orderId/request-payment')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  requestPaymentPatch(@Param('orderId') orderId: string, @CurrentUser() waiter: AuthUser) {
    return this.ordersService.requestPayment(orderId, waiter);
  }

  @Post(':orderId/cancel')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  cancelOrder(@Param('orderId') orderId: string, @Body() dto: CancelOrderDto, @CurrentUser() user: AuthUser) {
    return this.ordersService.cancelOrder(orderId, dto.reason, user);
  }

  @Patch(':orderId/cancel')
  @Roles(...ORDER_OPERATORS)
  @Permissions('orders:update')
  cancelOrderPatch(@Param('orderId') orderId: string, @Body() dto: CancelOrderDto, @CurrentUser() user: AuthUser) {
    return this.ordersService.cancelOrder(orderId, dto.reason, user);
  }
}
