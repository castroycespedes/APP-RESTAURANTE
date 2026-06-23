import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ADMIN_PANEL_ROLES } from '../auth/access-control';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_PANEL_ROLES)
@Permissions('customers:manage')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser() actor: AuthUser) {
    return this.customersService.create(dto, actor.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() actor: AuthUser) {
    return this.customersService.update(id, dto, actor.id);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.customersService.deactivate(id, actor.id);
  }
}
