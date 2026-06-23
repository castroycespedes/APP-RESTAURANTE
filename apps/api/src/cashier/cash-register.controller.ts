import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CashierService } from './cashier.service';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';

const CASHIER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER];

@Controller('cash-register')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CASHIER_ROLES)
export class CashRegisterController {
  constructor(private readonly cashierService: CashierService) {}

  @Get('current')
  @Permissions('payments:read')
  current(@CurrentUser() user: AuthUser) {
    return this.cashierService.findCurrentCashRegister(user);
  }

  @Post('open')
  @Permissions('cash_register:manage')
  open(@Body() dto: OpenCashRegisterDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.openCashRegister(dto, user);
  }

  @Post('close')
  @Permissions('cash_register:manage')
  close(@Body() dto: CloseCashRegisterDto, @CurrentUser() user: AuthUser) {
    return this.cashierService.closeCurrentCashRegister(dto, user);
  }

  @Get('pending-tables')
  @Permissions('payments:read')
  pendingTables() {
    return this.cashierService.pendingTables();
  }
}
