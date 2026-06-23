import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MenuItemsController } from './menu-items.controller';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [MenuController, MenuItemsController],
  providers: [MenuService]
})
export class MenuModule {}
