-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchases" (
    "id" UUID NOT NULL,
    "supplierId" UUID,
    "userId" UUID,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchase_items" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "period" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" UUID NOT NULL,
    "countId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "systemStock" DECIMAL(14,3) NOT NULL,
    "countedStock" DECIMAL(14,3) NOT NULL,
    "difference" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

-- CreateIndex
CREATE INDEX "suppliers_createdAt_idx" ON "suppliers"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_purchases_supplierId_idx" ON "inventory_purchases"("supplierId");

-- CreateIndex
CREATE INDEX "inventory_purchases_userId_idx" ON "inventory_purchases"("userId");

-- CreateIndex
CREATE INDEX "inventory_purchases_purchasedAt_idx" ON "inventory_purchases"("purchasedAt");

-- CreateIndex
CREATE INDEX "inventory_purchases_createdAt_idx" ON "inventory_purchases"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_purchase_items_purchaseId_idx" ON "inventory_purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "inventory_purchase_items_ingredientId_idx" ON "inventory_purchase_items"("ingredientId");

-- CreateIndex
CREATE INDEX "inventory_purchase_items_createdAt_idx" ON "inventory_purchase_items"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_counts_userId_idx" ON "inventory_counts"("userId");

-- CreateIndex
CREATE INDEX "inventory_counts_period_idx" ON "inventory_counts"("period");

-- CreateIndex
CREATE INDEX "inventory_counts_createdAt_idx" ON "inventory_counts"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_count_items_countId_idx" ON "inventory_count_items"("countId");

-- CreateIndex
CREATE INDEX "inventory_count_items_ingredientId_idx" ON "inventory_count_items"("ingredientId");

-- CreateIndex
CREATE INDEX "inventory_count_items_status_idx" ON "inventory_count_items"("status");

-- CreateIndex
CREATE INDEX "inventory_count_items_createdAt_idx" ON "inventory_count_items"("createdAt");

-- AddForeignKey
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchases" ADD CONSTRAINT "inventory_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_items" ADD CONSTRAINT "inventory_purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "inventory_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_items" ADD CONSTRAINT "inventory_purchase_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "inventory_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
