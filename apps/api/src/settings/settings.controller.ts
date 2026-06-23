import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ADMIN_PANEL_ROLES } from '../auth/access-control';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { BulkUpsertSettingsDto } from './dto/bulk-upsert-settings.dto';
import { SettingsService } from './settings.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_PANEL_ROLES)
@Permissions('settings:manage')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateSettingDto, @CurrentUser() actor: AuthUser) {
    return this.settingsService.create(dto, actor.id);
  }

  @Post('bulk')
  bulkUpsert(@Body() dto: BulkUpsertSettingsDto, @CurrentUser() actor: AuthUser) {
    return this.settingsService.bulkUpsert(dto, actor.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSettingDto, @CurrentUser() actor: AuthUser) {
    return this.settingsService.update(id, dto, actor.id);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.settingsService.deactivate(id, actor.id);
  }
}
