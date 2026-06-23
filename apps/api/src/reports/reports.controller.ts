import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService, ReportQuery } from './reports.service';

const REPORT_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER];

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...REPORT_ROLES)
@Permissions('reports:read')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findReports(@Query() query: ReportQuery, @CurrentUser() user: AuthUser) {
    return this.reportsService.findReports(query, user);
  }
}
