import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CashRegisterController } from './cash-register.controller';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';
import { OrderCheckoutController } from './order-checkout.controller';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [CashierController, CashRegisterController, OrderCheckoutController],
  providers: [CashierService]
})
export class CashierModule {}
