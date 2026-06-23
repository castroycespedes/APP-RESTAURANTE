import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [ThemeController],
  providers: [ThemeService]
})
export class ThemeModule {}
