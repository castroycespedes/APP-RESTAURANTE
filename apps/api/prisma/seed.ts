import { MenuItemType, PrismaClient, UserRole } from '@prisma/client';
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

const menuSeed = [
  {
    name: 'Platos fuertes',
    description: 'Platos principales para servicio en mesa.',
    sortOrder: 10,
    subcategories: [
      {
        name: 'Carnes',
        products: [
          {
            name: 'Punta gorda a la parrilla',
            description: 'Corte de carne acompanado de arroz, ensalada y papas.',
            price: 28000
          }
        ]
      },
      {
        name: 'Pollos',
        products: [
          {
            name: 'Pechuga a la plancha',
            description: 'Pechuga con guarnicion de arroz y vegetales.',
            price: 22000
          }
        ]
      },
      {
        name: 'Pastas',
        products: [
          {
            name: 'Pasta en salsa de la casa',
            description: 'Pasta con salsa especial y queso.',
            price: 18000
          }
        ]
      }
    ]
  },
  {
    name: 'Bebidas',
    description: 'Bebidas frias y calientes.',
    sortOrder: 20,
    subcategories: [
      {
        name: 'Gaseosas',
        products: [{ name: 'Gaseosa personal', description: 'Bebida gaseosa personal.', price: 5000, type: MenuItemType.DRINK }]
      },
      {
        name: 'Jugos naturales',
        products: [{ name: 'Jugo natural', description: 'Jugo natural preparado al momento.', price: 7000, type: MenuItemType.DRINK }]
      },
      {
        name: 'Agua',
        products: [{ name: 'Agua', description: 'Botella de agua personal.', price: 4000, type: MenuItemType.DRINK }]
      }
    ]
  },
  {
    name: 'Postres',
    description: 'Postres de la casa.',
    sortOrder: 30,
    subcategories: [
      { name: 'Frios', products: [{ name: 'Flan de la casa', description: 'Flan cremoso preparado en casa.', price: 9000 }] },
      { name: 'Calientes', products: [{ name: 'Brownie con helado', description: 'Brownie tibio con helado.', price: 12000 }] },
      { name: 'Especiales', products: [{ name: 'Tres leches', description: 'Postre tres leches tradicional.', price: 10000 }] }
    ]
  },
  {
    name: 'Entradas',
    description: 'Entradas para compartir.',
    sortOrder: 40,
    subcategories: [
      { name: 'Frituras', products: [{ name: 'Empanadas', description: 'Empanadas crocantes de la casa.', price: 9000 }] },
      { name: 'Acompanamientos', products: [{ name: 'Patacones', description: 'Patacones con hogao.', price: 10000 }] },
      { name: 'Sopas', products: [{ name: 'Sopa del dia', description: 'Sopa preparada del dia.', price: 11000 }] }
    ]
  },
  {
    name: 'Para llevar',
    description: 'Opciones empacadas para llevar.',
    sortOrder: 50,
    subcategories: [
      { name: 'Combos', products: [{ name: 'Combo ejecutivo', description: 'Plato ejecutivo empacado con bebida.', price: 24000 }] },
      { name: 'Empacados', products: [{ name: 'Plato empacado', description: 'Plato principal listo para llevar.', price: 20000 }] },
      { name: 'Bebidas para llevar', products: [{ name: 'Bebida para llevar', description: 'Bebida sellada para llevar.', price: 5000, type: MenuItemType.DRINK }] }
    ]
  },
  {
    name: 'Adicionales',
    description: 'Adiciones y acompanamientos.',
    sortOrder: 60,
    subcategories: [
      { name: 'Quesos', products: [{ name: 'Extra queso', description: 'Porcion adicional de queso.', price: 3000, type: MenuItemType.ADD_ON }] },
      { name: 'Acompanamientos', products: [{ name: 'Porcion de arroz', description: 'Porcion adicional de arroz.', price: 4000, type: MenuItemType.ADD_ON }] },
      { name: 'Salsas', products: [{ name: 'Salsa adicional', description: 'Salsa adicional de la casa.', price: 2000, type: MenuItemType.ADD_ON }] }
    ]
  }
];

const categoryModifierSeed: Record<string, Array<{ name: string; priceDelta?: number }>> = {
  'Platos fuertes': [
    { name: 'Sin cebolla' },
    { name: 'Sin salsa' },
    { name: 'Termino medio' },
    { name: 'Bien asado' },
    { name: 'Extra queso', priceDelta: 3000 }
  ],
  Bebidas: [
    { name: 'Con hielo' },
    { name: 'Sin hielo' },
    { name: 'Poco hielo' },
    { name: 'Sin azucar' },
    { name: 'Con limon' }
  ],
  Postres: [
    { name: 'Con salsa' },
    { name: 'Sin salsa' },
    { name: 'Salsa de chocolate', priceDelta: 2000 },
    { name: 'Toppings', priceDelta: 2500 },
    { name: 'Extra crema', priceDelta: 2500 }
  ],
  Entradas: [
    { name: 'Con salsa' },
    { name: 'Sin salsa' },
    { name: 'Picante' },
    { name: 'Sin picante' }
  ],
  'Para llevar': [
    { name: 'Empacado para llevar' },
    { name: 'Cubiertos' },
    { name: 'Salsa aparte' }
  ]
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
      value: 'AVAILABLE',
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
      value: 'false',
      description: 'Solo permite cobrar ordenes enviadas a caja desde Pedidos.',
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

  await seedOperationalMenu();
  await mergeDuplicateSeedCategories();
  await mergeDuplicateSeedSubcategories();
}

async function seedOperationalMenu() {
  for (const [categoryIndex, categorySeed] of menuSeed.entries()) {
    const category = await findOrCreateCategory(categorySeed.name, null, {
      description: categorySeed.description,
      sortOrder: categorySeed.sortOrder ?? categoryIndex * 10
    });

    for (const [subcategoryIndex, subcategorySeed] of categorySeed.subcategories.entries()) {
      const subcategory = await findOrCreateCategory(subcategorySeed.name, category.id, {
        description: `${subcategorySeed.name} de ${categorySeed.name}`,
        sortOrder: subcategoryIndex * 10
      });

      for (const [productIndex, productSeed] of subcategorySeed.products.entries()) {
        const sku = `POS-${slug(categorySeed.name)}-${slug(subcategorySeed.name)}-${productIndex + 1}`;

        const item = await prisma.menuItem.upsert({
          where: { sku },
          update: {
            categoryId: subcategory.id,
            type: productSeed.type ?? MenuItemType.DISH,
            name: productSeed.name,
            description: productSeed.description,
            price: productSeed.price,
            isAvailable: true,
            isActive: true,
            showForWaiters: true,
            showInPublicMenu: true
          },
          create: {
            sku,
            categoryId: subcategory.id,
            type: productSeed.type ?? MenuItemType.DISH,
            name: productSeed.name,
            description: productSeed.description,
            price: productSeed.price,
            isAvailable: true,
            isActive: true,
            showForWaiters: true,
            showInPublicMenu: true
          }
        });

        for (const modifier of categoryModifierSeed[categorySeed.name] ?? []) {
          await seedDefaultModifier(item.id, modifier.name, modifier.priceDelta ?? 0);
        }

        const allowedModifierNames = new Set((categoryModifierSeed[categorySeed.name] ?? []).map((modifier) => modifier.name));

        if (allowedModifierNames.size > 0) {
          await prisma.menuItemModifier.updateMany({
            where: {
              menuItemId: item.id,
              name: { notIn: Array.from(allowedModifierNames) }
            },
            data: { isActive: false }
          });
        }
      }
    }
  }
}

async function findOrCreateCategory(
  name: string,
  parentId: string | null,
  data: { description?: string; sortOrder: number }
) {
  const current = await prisma.menuCategory.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      parentId
    }
  });

  if (current) {
    return prisma.menuCategory.update({
      where: { id: current.id },
      data: {
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: true
      }
    });
  }

  return prisma.menuCategory.create({
    data: {
      name,
      parentId,
      description: data.description,
      sortOrder: data.sortOrder,
      isActive: true
    }
  });
}

async function mergeDuplicateSeedCategories() {
  for (const categorySeed of menuSeed) {
    const candidates = await prisma.menuCategory.findMany({
      where: {
        name: { equals: categorySeed.name, mode: 'insensitive' },
        parentId: null
      },
      include: {
        children: true,
        items: true
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    if (candidates.length <= 1) {
      continue;
    }

    const keeper =
      candidates.find((category) => category.name === categorySeed.name && category.children.length > 0) ??
      candidates.find((category) => category.children.length > 0) ??
      candidates[0];
    const duplicates = candidates.filter((category) => category.id !== keeper.id);

    for (const duplicate of duplicates) {
      await prisma.menuCategory.updateMany({
        where: { parentId: duplicate.id },
        data: { parentId: keeper.id }
      });
      await prisma.menuItem.updateMany({
        where: { categoryId: duplicate.id },
        data: { categoryId: keeper.id }
      });
      await prisma.menuCategory.update({
        where: { id: duplicate.id },
        data: { isActive: false }
      });
    }
  }
}

async function mergeDuplicateSeedSubcategories() {
  for (const categorySeed of menuSeed) {
    const parent = await prisma.menuCategory.findFirst({
      where: {
        name: { equals: categorySeed.name, mode: 'insensitive' },
        parentId: null,
        isActive: true
      }
    });

    if (!parent) {
      continue;
    }

    for (const subcategorySeed of categorySeed.subcategories) {
      const candidates = await prisma.menuCategory.findMany({
        where: {
          name: { equals: subcategorySeed.name, mode: 'insensitive' },
          parentId: parent.id
        },
        include: {
          items: true
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      });

      if (candidates.length <= 1) {
        continue;
      }

      const keeper =
        candidates.find((category) => category.name === subcategorySeed.name && category.items.length > 0) ??
        candidates.find((category) => category.items.length > 0) ??
        candidates[0];
      const duplicates = candidates.filter((category) => category.id !== keeper.id);

      for (const duplicate of duplicates) {
        await prisma.menuItem.updateMany({
          where: { categoryId: duplicate.id },
          data: { categoryId: keeper.id }
        });
        await prisma.menuCategory.update({
          where: { id: duplicate.id },
          data: { isActive: false }
        });
      }
    }
  }
}

async function seedDefaultModifier(menuItemId: string, name: string, priceDelta: number) {
  const current = await prisma.menuItemModifier.findFirst({
    where: {
      menuItemId,
      name
    }
  });

  if (current) {
    return prisma.menuItemModifier.update({
      where: { id: current.id },
      data: {
        priceDelta,
        isActive: true
      }
    });
  }

  return prisma.menuItemModifier.create({
    data: {
      menuItemId,
      name,
      priceDelta,
      isActive: true
    }
  });
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
