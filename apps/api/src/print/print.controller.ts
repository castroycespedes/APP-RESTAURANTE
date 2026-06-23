import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePrinterConfigDto } from './dto/create-printer-config.dto';
import { UpdatePrintJobStatusDto } from './dto/update-print-job-status.dto';
import { PrintService } from './print.service';

const PRINT_MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER];
const PRINT_OPERATORS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN];

@Controller('print')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Get('jobs')
  @Roles(...PRINT_OPERATORS)
  findQueue() {
    return this.printService.findQueue();
  }

  @Post('kitchen-tickets/:ticketId/jobs')
  @Roles(...PRINT_OPERATORS)
  enqueueKitchenTicket(@Param('ticketId') ticketId: string, @CurrentUser() user: AuthUser) {
    return this.printService.enqueueKitchenTicket(ticketId, user.id);
  }

  @Patch('jobs/:jobId/status')
  @Roles(...PRINT_OPERATORS)
  updateJobStatus(
    @Param('jobId') jobId: string,
    @Body() dto: UpdatePrintJobStatusDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.printService.updateJobStatus(jobId, dto.status, user.id, dto.errorMessage);
  }

  @Get('printer-configs')
  @Roles(...PRINT_MANAGERS)
  findPrinterConfigs() {
    return this.printService.findPrinterConfigs();
  }

  @Post('printer-configs')
  @Roles(...PRINT_MANAGERS)
  createPrinterConfig(@Body() dto: CreatePrinterConfigDto, @CurrentUser() user: AuthUser) {
    return this.printService.createPrinterConfig(dto, user.id);
  }
}
