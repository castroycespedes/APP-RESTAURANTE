import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateTicketItemStatusDto } from './dto/update-ticket-item-status.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { KitchenService } from './kitchen.service';

const KITCHEN_OPERATORS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN];

@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('tickets')
  @Roles(...KITCHEN_OPERATORS)
  @Permissions('kitchen:read')
  findActiveTickets() {
    return this.kitchenService.findActiveTickets();
  }

  @Patch('tickets/:ticketId/status')
  @Roles(...KITCHEN_OPERATORS)
  @Permissions('kitchen:update')
  updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.kitchenService.updateTicketStatus(ticketId, dto.status, user.id);
  }

  @Patch('tickets/:ticketId/items/:itemId/status')
  @Roles(...KITCHEN_OPERATORS)
  @Permissions('kitchen:update')
  updateTicketItemStatus(
    @Param('ticketId') ticketId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTicketItemStatusDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.kitchenService.updateTicketItemStatus(ticketId, itemId, dto.status, user.id);
  }
}
