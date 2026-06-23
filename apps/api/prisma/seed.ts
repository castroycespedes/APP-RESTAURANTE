import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const rolePermissions: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'users:manage',
    'employees:manage',
    'customers:manage',
    'tables:manage',
    'menu:read',
    'menu:manage',
    'orders:manage',
    'payments:manage',
    'cash_register:manage',
    'discounts:apply',
    'inventory:manage',
    'reports:read',
    'settings:manage'
  ],
  MANAGER: [
    'employees:read',
    'customers:manage',
    'tables:manage',
    'menu:read',
    'menu:manage',
    'orders:manage',
    'payments:read',
    'payments:create',
    'cash_register:manage',
    'discounts:apply',
    'inventory:read',
    'reports:read',
    'settings:manage'
  ],
  WAITER: ['tables:read', 'menu:read', 'orders:create', 'orders:read', 'orders:update'],
  KITCHEN: ['kitchen:read', 'kitchen:update', 'menu:read', 'orders:read'],
  CASHIER: ['orders:read', 'payments:create', 'payments:read', 'cash_register:manage', 'discounts:apply'],
  INVENTORY: ['inventory:read', 'inventory:manage', 'menu:read']
};

const roleNames: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  WAITER: 'Waiter',
  KITCHEN: 'Kitchen',
  CASHIER: 'Cashier',
  INVENTORY: 'Inventory'
};

async function main() {
  for (const role of Object.values(UserRole)) {
    await prisma.role.upsert({
      where: { key: role },
      update: {
        name: roleNames[role],
        permissions: rolePermissions[role],
        isActive: true
      },
      create: {
        key: role,
        name: roleNames[role],
        permissions: rolePermissions[role],
        isActive: true
      }
    });
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { key: UserRole.SUPER_ADMIN }
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@restaurant.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: superAdminRole.id,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      isActive: true
    },
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      firstName: 'System',
      lastName: 'Admin',
      roleId: superAdminRole.id,
      isActive: true
    }
  });

  const defaultTheme = {
    restaurantName: 'Mi Restaurante',
    logoUrl: null,
    primaryColor: '#0f766e',
    secondaryColor: '#d97706',
    backgroundColor: '#eef2f1',
    textColor: '#17211f',
    buttonColor: '#0f766e',
    cardColor: '#ffffff',
    borderRadius: '8px',
    fontFamily: 'Inter, system-ui, sans-serif',
    darkModeEnabled: false
  };

  const activeTheme = await prisma.appTheme.findFirst({
    orderBy: { updatedAt: 'desc' }
  });

  if (activeTheme) {
    await prisma.appTheme.update({
      where: { id: activeTheme.id },
      data: defaultTheme
    });
  } else {
    await prisma.appTheme.create({
      data: defaultTheme
    });
  }

  const defaultSettings = [
    {
      key: 'restaurant_legal_name',
      label: 'Nombre comercial',
      value: 'Mi Restaurante',
      description: 'Nombre comercial visible en recibos, reportes y carta.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_tax_id',
      label: 'NIT/RUC',
      value: '',
      description: 'Identificacion fiscal del restaurante.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_address',
      label: 'Direccion',
      value: '',
      description: 'Direccion fiscal o comercial.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_phone',
      label: 'Telefono',
      value: '',
      description: 'Telefono de contacto.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_email',
      label: 'Email',
      value: '',
      description: 'Correo de contacto.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_logo_url',
      label: 'Logo',
      value: '',
      description: 'URL del logo usado en recibos y reportes.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_city',
      label: 'Ciudad',
      value: '',
      description: 'Ciudad del restaurante.',
      group: 'restaurant'
    },
    {
      key: 'restaurant_country',
      label: 'Pais',
      value: 'Colombia',
      description: 'Pais del restaurante.',
      group: 'restaurant'
    },
    {
      key: 'currency',
      label: 'Moneda',
      value: 'COP',
      description: 'Codigo de moneda para cobros y reportes.',
      group: 'operation'
    },
    {
      key: 'timezone',
      label: 'Zona horaria',
      value: 'America/Bogota',
      description: 'Zona horaria operativa.',
      group: 'operation'
    },
    {
      key: 'language',
      label: 'Idioma',
      value: 'es-CO',
      description: 'Idioma principal del sistema.',
      group: 'operation'
    },
    {
      key: 'table_status_after_payment',
      label: 'Mesa al pagar',
      value: 'CLEANING',
      description: 'Estado que recibe una mesa cuando la orden queda pagada.',
      group: 'cashier'
    },
    {
      key: 'allow_custom_tip',
      label: 'Permitir propina personalizada',
      value: 'true',
      description: 'Permite editar la propina manualmente en caja.',
      group: 'cashier'
    },
    {
      key: 'allow_waiter_discounts',
      label: 'Mesero aplica descuentos',
      value: 'false',
      description: 'Permite a meseros aplicar descuentos menores.',
      group: 'cashier'
    },
    {
      key: 'require_open_cash_register',
      label: 'Requerir caja abierta',
      value: 'true',
      description: 'Impide cobrar si no existe caja abierta.',
      group: 'cashier'
    },
    {
      key: 'allow_cashier_request_payment',
      label: 'Caja puede pasar a cuenta',
      value: 'true',
      description: 'Permite que caja ponga una orden en espera de pago para cobrarla.',
      group: 'cashier'
    },
    {
      key: 'allow_mixed_payments',
      label: 'Permitir pagos mixtos',
      value: 'true',
      description: 'Permite combinar metodos de pago.',
      group: 'cashier'
    },
    {
      key: 'allow_split_bill',
      label: 'Permitir dividir cuenta',
      value: 'true',
      description: 'Muestra herramienta para dividir cuenta.',
      group: 'cashier'
    },
    {
      key: 'print_receipt_after_payment',
      label: 'Imprimir recibo despues de pagar',
      value: 'true',
      description: 'Prepara recibo al registrar pago completo.',
      group: 'cashier'
    },
    {
      key: 'show_tip_on_receipt',
      label: 'Mostrar propina en recibo',
      value: 'true',
      description: 'Incluye propina en recibos.',
      group: 'cashier'
    },
    {
      key: 'allow_waiter_open_table',
      label: 'Mesero abre mesa',
      value: 'true',
      description: 'Permite a meseros abrir orden en mesas asignadas.',
      group: 'tables'
    },
    {
      key: 'allow_change_table_waiter',
      label: 'Cambiar mesero de mesa',
      value: 'true',
      description: 'Permite reasignar mesas desde administracion.',
      group: 'tables'
    },
    {
      key: 'allow_move_products_between_tables',
      label: 'Mover productos entre mesas',
      value: 'false',
      description: 'Prepara flujo futuro de traslado de productos.',
      group: 'tables'
    },
    {
      key: 'allow_join_tables',
      label: 'Unir mesas',
      value: 'false',
      description: 'Prepara flujo futuro de union de mesas.',
      group: 'tables'
    },
    {
      key: 'allow_split_table',
      label: 'Dividir mesa',
      value: 'false',
      description: 'Prepara flujo futuro de division de mesa.',
      group: 'tables'
    },
    {
      key: 'use_kitchen_screen',
      label: 'Usar pantalla de cocina',
      value: 'true',
      description: 'Activa kanban de cocina.',
      group: 'kitchen'
    },
    {
      key: 'auto_print_kitchen_ticket',
      label: 'Imprimir ticket automatico',
      value: 'false',
      description: 'Preparado para agente local o impresora de red.',
      group: 'kitchen'
    },
    {
      key: 'kitchen_group_tickets_by',
      label: 'Agrupar comandas',
      value: 'table',
      description: 'table o category.',
      group: 'kitchen'
    },
    {
      key: 'delayed_order_alert_minutes',
      label: 'Alerta pedido demorado',
      value: '20',
      description: 'Minutos para resaltar comanda demorada.',
      group: 'kitchen'
    },
    {
      key: 'hide_sold_out_for_waiters',
      label: 'Ocultar agotados a meseros',
      value: 'true',
      description: 'Los productos agotados no aparecen en menu operativo.',
      group: 'menu'
    },
    {
      key: 'hide_sold_out_public_menu',
      label: 'Ocultar agotados en carta',
      value: 'true',
      description: 'La carta descargable oculta agotados por defecto.',
      group: 'menu'
    },
    {
      key: 'show_product_images',
      label: 'Mostrar imagenes productos',
      value: 'true',
      description: 'Muestra imagenes en menu y carta cuando existan.',
      group: 'menu'
    },
    {
      key: 'show_product_descriptions',
      label: 'Mostrar descripciones',
      value: 'true',
      description: 'Muestra descripciones en menu y carta.',
      group: 'menu'
    },
    {
      key: 'session_expiration_minutes',
      label: 'Expiracion de sesion',
      value: '480',
      description: 'Minutos de sesion antes de solicitar login nuevamente.',
      group: 'security'
    },
    {
      key: 'require_reason_cancel_product',
      label: 'Motivo al cancelar producto',
      value: 'true',
      description: 'Exige motivo para cancelar productos enviados.',
      group: 'security'
    },
    {
      key: 'require_permission_discounts',
      label: 'Permiso para descuentos',
      value: 'true',
      description: 'Activa validacion de permisos para descuentos altos.',
      group: 'security'
    },
    {
      key: 'require_permission_cancel_sent_order',
      label: 'Permiso cancelar enviado',
      value: 'true',
      description: 'Exige permiso para cancelar orden enviada a cocina.',
      group: 'security'
    },
    {
      key: 'default_tax_rate',
      label: 'Impuesto default',
      value: '0',
      description: 'Porcentaje de impuesto aplicado por defecto a las ordenes.',
      group: 'orders'
    },
    {
      key: 'suggested_tip_rate',
      label: 'Propina sugerida',
      value: '10',
      description: 'Porcentaje de propina sugerida en caja.',
      group: 'cashier'
    },
    {
      key: 'discount_manager_percent_threshold',
      label: 'Descuento % requiere manager',
      value: '10',
      description: 'Porcentaje maximo antes de exigir rol manager o admin.',
      group: 'cashier'
    },
    {
      key: 'discount_manager_amount_threshold',
      label: 'Descuento valor requiere manager',
      value: '50000',
      description: 'Valor fijo maximo antes de exigir rol manager o admin.',
      group: 'cashier'
    },
    {
      key: 'allow_waiter_cancel_pending_items',
      label: 'Mesero cancela pendientes',
      value: 'true',
      description: 'Permite que el mesero retire productos pendientes antes de enviarlos a cocina.',
      group: 'orders'
    }
  ];

  for (const setting of defaultSettings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
