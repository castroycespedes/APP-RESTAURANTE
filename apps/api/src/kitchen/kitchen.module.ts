import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { KitchenController } from './kitchen.controller';
import { KitchenGateway } from './kitchen.gateway';
import { KitchenService } from './kitchen.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [KitchenController],
  providers: [KitchenGateway, KitchenService],
  exports: [KitchenGateway]
})
export class KitchenModule {}
