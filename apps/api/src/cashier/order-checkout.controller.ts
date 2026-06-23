import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CashierService } from './cashier.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';

const CASHIER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER];

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CASHIER_ROLES)
export class OrderCheckoutController {
  constructor(private readonly cashierService: CashierService) {}

  @Get(':orderId/pre-invoice')
  @Permissions('payments:read')
  preInvoice(@Param('orderId') orderId: string) {
    return this.cashierService.preInvoice(orderId);
  }

  @Post(':orderId/preview-invoice')
  @Permissions('payments:read')
  previewInvoice(@Param('orderId') orderId: string) {
    return this.cashierService.preInvoice(orderId);
  }

  @Post(':orderId/checkout')
  @Permissions('payments:create')
  checkout(@Param('orderId') orderId: string, @Body() dto: RegisterPaymentDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.checkoutOrder(orderId, dto, user);
  }

  @Patch(':orderId/mark-waiting-payment')
  @Permissions('payments:create')
  markWaitingPayment(@Param('orderId') orderId: string, @CurrentUser() user: AuthUser) {
    return this.cashierService.markWaitingPaymentFromCashier(orderId, user);
  }

  @Get(':orderId/final-receipt')
  @Permissions('payments:read')
  finalReceipt(@Param('orderId') orderId: string) {
    return this.cashierService.finalReceipt(orderId);
  }
}
