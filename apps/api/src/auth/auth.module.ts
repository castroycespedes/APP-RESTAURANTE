import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [JwtModule.register({}), AuditModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, LoginRateLimitGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, LoginRateLimitGuard, RolesGuard, JwtModule]
})
export class AuthModule {}
