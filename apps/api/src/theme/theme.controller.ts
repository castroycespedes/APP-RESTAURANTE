import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SaveLogoDto } from './dto/save-logo.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { ThemeService } from './theme.service';

const THEME_MANAGERS = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER];

@Controller('theme')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get('current')
  getCurrentTheme() {
    return this.themeService.getCurrentTheme();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...THEME_MANAGERS)
  @Permissions('settings:manage')
  updateTheme(@Body() dto: UpdateThemeDto, @CurrentUser() actor: AuthUser) {
    return this.themeService.updateTheme(dto, actor.id);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...THEME_MANAGERS)
  @Permissions('settings:manage')
  saveLogo(@Body() dto: SaveLogoDto, @CurrentUser() actor: AuthUser) {
    return this.themeService.saveLogo(dto, actor.id);
  }

  @Post('restore-default')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...THEME_MANAGERS)
  @Permissions('settings:manage')
  restoreDefault(@CurrentUser() actor: AuthUser) {
    return this.themeService.restoreDefault(actor.id);
  }
}
