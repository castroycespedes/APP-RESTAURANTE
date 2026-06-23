import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CashierModule } from './cashier/cashier.module';
import { CustomersModule } from './customers/customers.module';
import { EmployeesModule } from './employees/employees.module';
import { InventoryModule } from './inventory/inventory.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PrintModule } from './print/print.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TablesModule } from './tables/tables.module';
import { ThemeModule } from './theme/theme.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '../../.env'],
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    CashierModule,
    CustomersModule,
    UsersModule,
    EmployeesModule,
    InventoryModule,
    KitchenModule,
    MenuModule,
    OrdersModule,
    PrintModule,
    ReportsModule,
    SettingsModule,
    TablesModule,
    ThemeModule
  ]
})
export class AppModule {}
