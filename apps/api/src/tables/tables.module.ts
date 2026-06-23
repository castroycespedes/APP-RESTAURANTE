import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [TablesController],
  providers: [TablesService]
})
export class TablesModule {}
