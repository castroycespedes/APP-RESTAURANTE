-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER', 'INVENTORY');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('SQUARE', 'RECTANGLE', 'ROUND');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'OPEN', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED', 'WAITING_PAYMENT', 'PAID', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'SENT', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'QR', 'DIGITAL_WALLET', 'MIXED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'WASTE', 'RETURN');

-- CreateEnum
CREATE TYPE "KitchenTicketStatus" AS ENUM ('RECEIVED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FIX_AMOUNT');

-- CreateEnum
CREATE TYPE "MenuItemType" AS ENUM ('DISH', 'DRINK', 'ADD_ON');

-- CreateEnum
CREATE TYPE "CashRegisterStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrinterTargetType" AS ENUM ('DINING_AREA', 'MENU_CATEGORY', 'KITCHEN_STATION');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "documentId" TEXT,
    "position" TEXT,
    "hiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_areas" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" UUID NOT NULL,
    "diningAreaId" UUID NOT NULL,
    "assignedWaiterId" UUID,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "shape" "TableShape" NOT NULL DEFAULT 'SQUARE',
    "color" TEXT,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "posX" INTEGER NOT NULL DEFAULT 0,
    "posY" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "type" "MenuItemType" NOT NULL DEFAULT 'DISH',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "imageUrl" TEXT,
    "preparationTimeMinutes" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showInPublicMenu" BOOLEAN NOT NULL DEFAULT true,
    "showForWaiters" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_units" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCode" TEXT NOT NULL,
    "toBaseFactor" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_modifiers" (
    "id" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "maxQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" UUID,
    "unit" TEXT NOT NULL,
    "currentStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "unitId" UUID,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "userId" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "reason" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "tableId" UUID NOT NULL,
    "waiterId" UUID,
    "customerId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tipTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_modifiers" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "menuItemModifierId" UUID NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_tickets" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "stationName" TEXT,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'RECEIVED',
    "claimedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_configs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "PrinterTargetType" NOT NULL,
    "diningAreaId" UUID,
    "menuCategoryId" UUID,
    "stationName" TEXT,
    "printerName" TEXT,
    "networkAddress" TEXT,
    "paperWidthMm" INTEGER NOT NULL DEFAULT 80,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printer_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" UUID NOT NULL,
    "kitchenTicketId" UUID,
    "printerConfigId" UUID,
    "createdById" UUID,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_ticket_items" (
    "id" UUID NOT NULL,
    "kitchenTicketId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_ticket_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "orderId" UUID,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "cashRegisterId" UUID,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" UUID NOT NULL,
    "closedById" UUID,
    "openingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingAmount" DECIMAL(12,2),
    "expectedAmount" DECIMAL(12,2),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_themes" (
    "id" UUID NOT NULL,
    "restaurant_name" TEXT NOT NULL DEFAULT 'Mi Restaurante',
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#0f766e',
    "secondary_color" TEXT NOT NULL DEFAULT '#d97706',
    "background_color" TEXT NOT NULL DEFAULT '#eef2f1',
    "text_color" TEXT NOT NULL DEFAULT '#17211f',
    "button_color" TEXT NOT NULL DEFAULT '#0f766e',
    "card_color" TEXT NOT NULL DEFAULT '#ffffff',
    "border_radius" TEXT NOT NULL DEFAULT '8px',
    "font_family" TEXT NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
    "dark_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "group" TEXT NOT NULL DEFAULT 'general',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_isActive_idx" ON "roles"("isActive");

-- CreateIndex
CREATE INDEX "roles_createdAt_idx" ON "roles"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_documentId_key" ON "employees"("documentId");

-- CreateIndex
CREATE INDEX "employees_userId_idx" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE INDEX "employees_createdAt_idx" ON "employees"("createdAt");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_isActive_idx" ON "customers"("isActive");

-- CreateIndex
CREATE INDEX "customers_createdAt_idx" ON "customers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dining_areas_name_key" ON "dining_areas"("name");

-- CreateIndex
CREATE INDEX "dining_areas_isActive_idx" ON "dining_areas"("isActive");

-- CreateIndex
CREATE INDEX "dining_areas_createdAt_idx" ON "dining_areas"("createdAt");

-- CreateIndex
CREATE INDEX "restaurant_tables_diningAreaId_idx" ON "restaurant_tables"("diningAreaId");

-- CreateIndex
CREATE INDEX "restaurant_tables_assignedWaiterId_idx" ON "restaurant_tables"("assignedWaiterId");

-- CreateIndex
CREATE INDEX "restaurant_tables_status_idx" ON "restaurant_tables"("status");

-- CreateIndex
CREATE INDEX "restaurant_tables_isActive_idx" ON "restaurant_tables"("isActive");

-- CreateIndex
CREATE INDEX "restaurant_tables_createdAt_idx" ON "restaurant_tables"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_diningAreaId_name_key" ON "restaurant_tables"("diningAreaId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_diningAreaId_number_key" ON "restaurant_tables"("diningAreaId", "number");

-- CreateIndex
CREATE INDEX "menu_categories_parentId_idx" ON "menu_categories"("parentId");

-- CreateIndex
CREATE INDEX "menu_categories_isActive_idx" ON "menu_categories"("isActive");

-- CreateIndex
CREATE INDEX "menu_categories_createdAt_idx" ON "menu_categories"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_sku_key" ON "menu_items"("sku");

-- CreateIndex
CREATE INDEX "menu_items_categoryId_idx" ON "menu_items"("categoryId");

-- CreateIndex
CREATE INDEX "menu_items_type_idx" ON "menu_items"("type");

-- CreateIndex
CREATE INDEX "menu_items_isAvailable_idx" ON "menu_items"("isAvailable");

-- CreateIndex
CREATE INDEX "menu_items_isActive_idx" ON "menu_items"("isActive");

-- CreateIndex
CREATE INDEX "menu_items_showInPublicMenu_idx" ON "menu_items"("showInPublicMenu");

-- CreateIndex
CREATE INDEX "menu_items_showForWaiters_idx" ON "menu_items"("showForWaiters");

-- CreateIndex
CREATE INDEX "menu_items_createdAt_idx" ON "menu_items"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_units_code_key" ON "measurement_units"("code");

-- CreateIndex
CREATE INDEX "measurement_units_baseCode_idx" ON "measurement_units"("baseCode");

-- CreateIndex
CREATE INDEX "measurement_units_isActive_idx" ON "measurement_units"("isActive");

-- CreateIndex
CREATE INDEX "menu_item_modifiers_menuItemId_idx" ON "menu_item_modifiers"("menuItemId");

-- CreateIndex
CREATE INDEX "menu_item_modifiers_isActive_idx" ON "menu_item_modifiers"("isActive");

-- CreateIndex
CREATE INDEX "menu_item_modifiers_createdAt_idx" ON "menu_item_modifiers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "ingredients_isActive_idx" ON "ingredients"("isActive");

-- CreateIndex
CREATE INDEX "ingredients_unitId_idx" ON "ingredients"("unitId");

-- CreateIndex
CREATE INDEX "ingredients_createdAt_idx" ON "ingredients"("createdAt");

-- CreateIndex
CREATE INDEX "recipes_menuItemId_idx" ON "recipes"("menuItemId");

-- CreateIndex
CREATE INDEX "recipes_ingredientId_idx" ON "recipes"("ingredientId");

-- CreateIndex
CREATE INDEX "recipes_unitId_idx" ON "recipes"("unitId");

-- CreateIndex
CREATE INDEX "recipes_isActive_idx" ON "recipes"("isActive");

-- CreateIndex
CREATE INDEX "recipes_createdAt_idx" ON "recipes"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_menuItemId_ingredientId_key" ON "recipes"("menuItemId", "ingredientId");

-- CreateIndex
CREATE INDEX "inventory_movements_ingredientId_idx" ON "inventory_movements"("ingredientId");

-- CreateIndex
CREATE INDEX "inventory_movements_userId_idx" ON "inventory_movements"("userId");

-- CreateIndex
CREATE INDEX "inventory_movements_type_idx" ON "inventory_movements"("type");

-- CreateIndex
CREATE INDEX "inventory_movements_createdAt_idx" ON "inventory_movements"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_tableId_idx" ON "orders"("tableId");

-- CreateIndex
CREATE INDEX "orders_waiterId_idx" ON "orders"("waiterId");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_menuItemId_idx" ON "order_items"("menuItemId");

-- CreateIndex
CREATE INDEX "order_items_status_idx" ON "order_items"("status");

-- CreateIndex
CREATE INDEX "order_items_createdAt_idx" ON "order_items"("createdAt");

-- CreateIndex
CREATE INDEX "order_item_modifiers_orderItemId_idx" ON "order_item_modifiers"("orderItemId");

-- CreateIndex
CREATE INDEX "order_item_modifiers_menuItemModifierId_idx" ON "order_item_modifiers"("menuItemModifierId");

-- CreateIndex
CREATE INDEX "kitchen_tickets_orderId_idx" ON "kitchen_tickets"("orderId");

-- CreateIndex
CREATE INDEX "kitchen_tickets_status_idx" ON "kitchen_tickets"("status");

-- CreateIndex
CREATE INDEX "kitchen_tickets_createdAt_idx" ON "kitchen_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "printer_configs_targetType_idx" ON "printer_configs"("targetType");

-- CreateIndex
CREATE INDEX "printer_configs_diningAreaId_idx" ON "printer_configs"("diningAreaId");

-- CreateIndex
CREATE INDEX "printer_configs_menuCategoryId_idx" ON "printer_configs"("menuCategoryId");

-- CreateIndex
CREATE INDEX "printer_configs_stationName_idx" ON "printer_configs"("stationName");

-- CreateIndex
CREATE INDEX "printer_configs_isActive_idx" ON "printer_configs"("isActive");

-- CreateIndex
CREATE INDEX "print_jobs_kitchenTicketId_idx" ON "print_jobs"("kitchenTicketId");

-- CreateIndex
CREATE INDEX "print_jobs_printerConfigId_idx" ON "print_jobs"("printerConfigId");

-- CreateIndex
CREATE INDEX "print_jobs_createdById_idx" ON "print_jobs"("createdById");

-- CreateIndex
CREATE INDEX "print_jobs_status_idx" ON "print_jobs"("status");

-- CreateIndex
CREATE INDEX "print_jobs_queuedAt_idx" ON "print_jobs"("queuedAt");

-- CreateIndex
CREATE INDEX "kitchen_ticket_items_kitchenTicketId_idx" ON "kitchen_ticket_items"("kitchenTicketId");

-- CreateIndex
CREATE INDEX "kitchen_ticket_items_orderItemId_idx" ON "kitchen_ticket_items"("orderItemId");

-- CreateIndex
CREATE INDEX "kitchen_ticket_items_status_idx" ON "kitchen_ticket_items"("status");

-- CreateIndex
CREATE INDEX "kitchen_ticket_items_createdAt_idx" ON "kitchen_ticket_items"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_ticket_items_kitchenTicketId_orderItemId_key" ON "kitchen_ticket_items"("kitchenTicketId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_orderId_idx" ON "discounts"("orderId");

-- CreateIndex
CREATE INDEX "discounts_isActive_idx" ON "discounts"("isActive");

-- CreateIndex
CREATE INDEX "discounts_createdAt_idx" ON "discounts"("createdAt");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_cashRegisterId_idx" ON "payments"("cashRegisterId");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "payments"("method");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE INDEX "cash_registers_openedById_idx" ON "cash_registers"("openedById");

-- CreateIndex
CREATE INDEX "cash_registers_closedById_idx" ON "cash_registers"("closedById");

-- CreateIndex
CREATE INDEX "cash_registers_status_idx" ON "cash_registers"("status");

-- CreateIndex
CREATE INDEX "cash_registers_createdAt_idx" ON "cash_registers"("createdAt");

-- CreateIndex
CREATE INDEX "app_themes_created_at_idx" ON "app_themes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_group_idx" ON "app_settings"("group");

-- CreateIndex
CREATE INDEX "app_settings_isActive_idx" ON "app_settings"("isActive");

-- CreateIndex
CREATE INDEX "app_settings_createdAt_idx" ON "app_settings"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_diningAreaId_fkey" FOREIGN KEY ("diningAreaId") REFERENCES "dining_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_assignedWaiterId_fkey" FOREIGN KEY ("assignedWaiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_modifiers" ADD CONSTRAINT "menu_item_modifiers_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_menuItemModifierId_fkey" FOREIGN KEY ("menuItemModifierId") REFERENCES "menu_item_modifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_configs" ADD CONSTRAINT "printer_configs_diningAreaId_fkey" FOREIGN KEY ("diningAreaId") REFERENCES "dining_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_configs" ADD CONSTRAINT "printer_configs_menuCategoryId_fkey" FOREIGN KEY ("menuCategoryId") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_kitchenTicketId_fkey" FOREIGN KEY ("kitchenTicketId") REFERENCES "kitchen_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printerConfigId_fkey" FOREIGN KEY ("printerConfigId") REFERENCES "printer_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_kitchenTicketId_fkey" FOREIGN KEY ("kitchenTicketId") REFERENCES "kitchen_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
