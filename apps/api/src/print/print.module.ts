import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrintController } from './print.controller';
import { PrintService } from './print.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [PrintController],
  providers: [PrintService],
  exports: [PrintService]
})
export class PrintModule {}
