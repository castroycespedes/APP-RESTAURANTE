import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddOrderItemDto } from '../orders/dto/add-order-item.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { CashierService } from './cashier.service';
import { UpdateDiscountDto } from './dto/update-discount.dto';

const CASHIER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER];

@Controller('cashier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CASHIER_ROLES)
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  @Get('orders/open')
  @Permissions('payments:read')
  openOrders() {
    return this.cashierService.openOrders();
  }

  @Get('tables/reserved')
  @Permissions('payments:read')
  reservedTables() {
    return this.cashierService.reservedTablesOverview();
  }

  @Get('tables/reservable')
  @Permissions('payments:read')
  reservableTables() {
    return this.cashierService.reservableTablesOverview();
  }

  @Post('tables/reserve')
  @Permissions('payments:create')
  reserveTable(@Body() dto: {
    tableId: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    guestCount?: number;
    depositAmount?: number;
    reservationDate?: string;
    notes?: string;
  }, @CurrentUser() user: AuthUser) {
    return this.cashierService.reserveTableFromCashier(dto, user);
  }

  @Get('config')
  @Permissions('payments:read')
  config() {
    return this.cashierService.findCashierConfig();
  }

  @Get('cash-registers/current')
  @Permissions('payments:read')
  currentCashRegister(@CurrentUser() user: AuthUser) {
    return this.cashierService.findCurrentCashRegister(user);
  }

  @Get('cash-registers/:id/summary')
  @Permissions('payments:read')
  cashRegisterSummary(@Param('id') id: string) {
    return this.cashierService.cashRegisterSummary(id);
  }

  @Get('orders/:orderId')
  @Permissions('payments:read')
  findOrder(@Param('orderId') orderId: string) {
    return this.cashierService.findOrder(orderId);
  }

  @Get('discounts')
  @Permissions('discounts:apply')
  findDiscounts() {
    return this.cashierService.findDiscounts();
  }

  @Post('discounts')
  @Permissions('discounts:apply')
  createDiscount(@Body() dto: ApplyDiscountDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.createDiscount(dto, user);
  }

  @Patch('discounts/:id')
  @Permissions('discounts:apply')
  updateDiscount(@Param('id') id: string, @Body() dto: UpdateDiscountDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.updateDiscount(id, dto, user);
  }

  @Delete('discounts/:id')
  @Permissions('discounts:apply')
  deactivateDiscount(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.cashierService.deactivateDiscount(id, user);
  }

  @Post('cash-registers/open')
  @Permissions('cash_register:manage')
  openCashRegister(@Body() dto: OpenCashRegisterDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.openCashRegister(dto, user);
  }

  @Patch('cash-registers/:id/close')
  @Permissions('cash_register:manage')
  closeCashRegister(@Param('id') id: string, @Body() dto: CloseCashRegisterDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.closeCashRegister(id, dto, user);
  }

  @Post('orders/:orderId/discounts')
  @Permissions('discounts:apply')
  applyDiscount(@Param('orderId') orderId: string, @Body() dto: ApplyDiscountDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.applyDiscount(orderId, dto, user);
  }

  @Post('orders/:orderId/request-payment')
  @Permissions('payments:create')
  requestPaymentFromCashier(@Param('orderId') orderId: string, @CurrentUser() user: AuthUser) {
    return this.cashierService.requestPaymentFromCashier(orderId, user);
  }

  @Post('orders/:orderId/last-minute-items')
  @Permissions('payments:create')
  addLastMinuteItem(@Param('orderId') orderId: string, @Body() dto: AddOrderItemDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.addLastMinuteItem(orderId, dto, user);
  }

  @Post('orders/:orderId/release-empty')
  @Permissions('payments:create')
  releaseEmptyOrder(@Param('orderId') orderId: string, @Body() dto: { reason?: string }, @CurrentUser() user: AuthUser) {
    return this.cashierService.releaseEmptyOrder(orderId, dto.reason ?? '', user);
  }

  @Post('orders/:orderId/cancel-authorized')
  @Permissions('payments:create')
  cancelAuthorizedOrder(
    @Param('orderId') orderId: string,
    @Body() dto: { authorizedBy?: string; reason?: string },
    @CurrentUser() user: AuthUser
  ) {
    return this.cashierService.cancelAuthorizedOrder(orderId, dto.reason ?? '', dto.authorizedBy ?? '', user);
  }

  @Post('orders/:orderId/payments')
  @Permissions('payments:create')
  registerPayment(@Param('orderId') orderId: string, @Body() dto: RegisterPaymentDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.registerPayment(orderId, dto, user);
  }
}
