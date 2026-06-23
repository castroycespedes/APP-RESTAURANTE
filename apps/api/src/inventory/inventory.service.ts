import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, OrderItemStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateIngredientDto } from './dto/create-ingredient.dto';
import type { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import type { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import type { CreateInventoryPurchaseDto } from './dto/create-inventory-purchase.dto';
import type { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import type { CreateRecipeDto } from './dto/create-recipe.dto';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateIngredientDto } from './dto/update-ingredient.dto';
import type { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import type { UpdateRecipeDto } from './dto/update-recipe.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

const ingredientInclude = {
  measurementUnit: true
} satisfies Prisma.IngredientInclude;

const recipeInclude = {
  menuItem: {
    select: {
      id: true,
      name: true,
      price: true
    }
  },
  ingredient: true,
  measurementUnit: true
} satisfies Prisma.RecipeInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findUnits() {
    return this.prisma.measurementUnit.findMany({
      orderBy: [{ baseCode: 'asc' }, { code: 'asc' }]
    });
  }

  async createUnit(dto: CreateMeasurementUnitDto, actorId: string) {
    const unit = await this.prisma.measurementUnit.create({ data: dto });
    await this.auditService.log({ userId: actorId, action: 'inventory.unit.create', entity: 'MeasurementUnit', entityId: unit.id, after: unit });
    return unit;
  }

  async updateUnit(id: string, dto: UpdateMeasurementUnitDto, actorId: string) {
    const current = await this.ensureUnit(id);
    const unit = await this.prisma.measurementUnit.update({ where: { id }, data: dto });
    await this.auditService.log({ userId: actorId, action: 'inventory.unit.update', entity: 'MeasurementUnit', entityId: id, before: current, after: unit });
    return unit;
  }

  findSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async createSupplier(dto: CreateSupplierDto, actorId: string) {
    const supplier = await this.prisma.supplier.create({ data: dto });
    await this.auditService.log({ userId: actorId, action: 'inventory.supplier.create', entity: 'Supplier', entityId: supplier.id, after: supplier });
    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, actorId: string) {
    const current = await this.ensureSupplier(id);
    const supplier = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.auditService.log({ userId: actorId, action: 'inventory.supplier.update', entity: 'Supplier', entityId: id, before: current, after: supplier });
    return supplier;
  }

  async deactivateSupplier(id: string, actorId: string) {
    return this.updateSupplier(id, { isActive: false }, actorId);
  }

  findIngredients() {
    return this.prisma.ingredient.findMany({
      include: ingredientInclude,
      orderBy: { name: 'asc' }
    });
  }

  findLowStockIngredients() {
    return this.prisma.ingredient.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: this.prisma.ingredient.fields.minimumStock
        }
      },
      include: ingredientInclude,
      orderBy: { name: 'asc' }
    });
  }

  async createIngredient(dto: CreateIngredientDto, actorId: string) {
    if (dto.unitId) {
      await this.ensureUnit(dto.unitId);
    }

    const ingredient = await this.prisma.ingredient.create({
      data: dto,
      include: ingredientInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'inventory.ingredient.create',
      entity: 'Ingredient',
      entityId: ingredient.id,
      after: ingredient
    });

    return ingredient;
  }

  async updateIngredient(id: string, dto: UpdateIngredientDto, actorId: string) {
    const current = await this.ensureIngredient(id);

    if (dto.unitId) {
      await this.ensureUnit(dto.unitId);
    }

    const ingredient = await this.prisma.ingredient.update({
      where: { id },
      data: dto,
      include: ingredientInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'inventory.ingredient.update',
      entity: 'Ingredient',
      entityId: id,
      before: current,
      after: ingredient
    });

    return ingredient;
  }

  async deactivateIngredient(id: string, actorId: string) {
    return this.updateIngredient(id, { isActive: false }, actorId);
  }

  findRecipes(menuItemId?: string) {
    return this.prisma.recipe.findMany({
      where: {
        menuItemId,
        isActive: true
      },
      include: recipeInclude,
      orderBy: [{ menuItem: { name: 'asc' } }, { ingredient: { name: 'asc' } }]
    });
  }

  async createRecipe(dto: CreateRecipeDto, actorId: string) {
    await this.ensureMenuItem(dto.menuItemId);
    await this.ensureIngredient(dto.ingredientId);
    await this.ensureRecipeIngredientIsUnique(dto.menuItemId, dto.ingredientId);

    if (dto.unitId) {
      await this.ensureUnit(dto.unitId);
    }

    const recipe = await this.prisma.recipe.create({
      data: dto,
      include: recipeInclude
    });

    await this.auditService.log({ userId: actorId, action: 'inventory.recipe.create', entity: 'Recipe', entityId: recipe.id, after: recipe });
    return recipe;
  }

  async updateRecipe(id: string, dto: UpdateRecipeDto, actorId: string) {
    const current = await this.ensureRecipe(id);

    if (dto.menuItemId) {
      await this.ensureMenuItem(dto.menuItemId);
    }

    if (dto.ingredientId) {
      await this.ensureIngredient(dto.ingredientId);
    }

    if (dto.unitId) {
      await this.ensureUnit(dto.unitId);
    }

    if (dto.menuItemId || dto.ingredientId) {
      await this.ensureRecipeIngredientIsUnique(
        dto.menuItemId ?? current.menuItemId,
        dto.ingredientId ?? current.ingredientId,
        id
      );
    }

    const recipe = await this.prisma.recipe.update({
      where: { id },
      data: dto,
      include: recipeInclude
    });

    await this.auditService.log({ userId: actorId, action: 'inventory.recipe.update', entity: 'Recipe', entityId: id, before: current, after: recipe });
    return recipe;
  }

  async deactivateRecipe(id: string, actorId: string) {
    return this.updateRecipe(id, { isActive: false }, actorId);
  }

  async estimateMenuItemCost(menuItemId: string) {
    await this.ensureMenuItem(menuItemId);
    const recipes = await this.findRecipes(menuItemId);

    const ingredients = recipes.map((recipe) => {
      const quantity = this.convertQuantity(Number(recipe.quantity), recipe.unit, recipe.ingredient.unit);
      const cost = quantity * Number(recipe.ingredient.averageCost);

      return {
        recipeId: recipe.id,
        ingredientId: recipe.ingredientId,
        ingredientName: recipe.ingredient.name,
        quantity,
        unit: recipe.ingredient.unit,
        cost
      };
    });

    return {
      menuItemId,
      ingredients,
      estimatedCost: ingredients.reduce((sum, item) => sum + item.cost, 0),
      price: Number(recipes[0]?.menuItem.price ?? 0),
      estimatedMargin: Number(recipes[0]?.menuItem.price ?? 0) - ingredients.reduce((sum, item) => sum + item.cost, 0)
    };
  }

  findMovements() {
    return this.prisma.inventoryMovement.findMany({
      include: {
        ingredient: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  findPurchases() {
    return this.prisma.inventoryPurchase.findMany({
      include: {
        supplier: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        items: {
          include: { ingredient: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { purchasedAt: 'desc' },
      take: 100
    });
  }

  async createPurchase(dto: CreateInventoryPurchaseDto, actorId: string) {
    if (!dto.items?.length) {
      throw new ConflictException('Purchase must include at least one item');
    }

    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: dto.items.map((item) => item.ingredientId) } }
    });
    const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredients.length !== new Set(dto.items.map((item) => item.ingredientId)).size) {
      throw new NotFoundException('One or more ingredients were not found');
    }

    const total = dto.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    const purchase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryPurchase.create({
        data: {
          supplierId: dto.supplierId,
          userId: actorId,
          invoiceNumber: dto.invoiceNumber,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
          notes: dto.notes,
          total: new Prisma.Decimal(total),
          items: {
            create: dto.items.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: new Prisma.Decimal(item.quantity),
              unit: item.unit,
              unitCost: new Prisma.Decimal(item.unitCost),
              totalCost: new Prisma.Decimal(item.quantity * item.unitCost)
            }))
          }
        },
        include: { supplier: true, items: { include: { ingredient: true } } }
      });

      for (const item of dto.items) {
        const ingredient = ingredientsById.get(item.ingredientId);
        const convertedQuantity = this.convertQuantity(item.quantity, item.unit, ingredient?.unit ?? item.unit);
        const nextStock = Number(ingredient?.currentStock ?? 0) + convertedQuantity;

        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            currentStock: new Prisma.Decimal(nextStock),
            averageCost: new Prisma.Decimal(item.unitCost)
          }
        });

        await tx.inventoryMovement.create({
          data: {
            ingredientId: item.ingredientId,
            userId: actorId,
            type: InventoryMovementType.PURCHASE,
            quantity: new Prisma.Decimal(convertedQuantity),
            unitCost: new Prisma.Decimal(item.unitCost),
            reason: `Compra${dto.invoiceNumber ? ` factura ${dto.invoiceNumber}` : ''}`,
            reference: created.id
          }
        });
      }

      return created;
    });

    await this.auditService.log({ userId: actorId, action: 'inventory.purchase.create', entity: 'InventoryPurchase', entityId: purchase.id, after: purchase });
    return purchase;
  }

  findCounts() {
    return this.prisma.inventoryCount.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        items: {
          include: { ingredient: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async createCount(dto: CreateInventoryCountDto, actorId: string) {
    if (!dto.items?.length) {
      throw new ConflictException('Inventory count must include at least one item');
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: dto.items.map((item) => item.ingredientId) } }
    });
    const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredients.length !== new Set(dto.items.map((item) => item.ingredientId)).size) {
      throw new NotFoundException('One or more ingredients were not found');
    }

    const count = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCount.create({
        data: {
          userId: actorId,
          period: dto.period,
          notes: dto.notes
        }
      });

      for (const item of dto.items) {
        const ingredient = ingredientsById.get(item.ingredientId);
        const systemStock = Number(ingredient?.currentStock ?? 0);
        const difference = item.countedStock - systemStock;
        const status = difference < 0 ? 'FALTANTE' : difference > 0 ? 'SOBRANTE' : 'NORMAL';

        const countItem = await tx.inventoryCountItem.create({
          data: {
            countId: created.id,
            ingredientId: item.ingredientId,
            systemStock: new Prisma.Decimal(systemStock),
            countedStock: new Prisma.Decimal(item.countedStock),
            difference: new Prisma.Decimal(difference),
            unit: ingredient?.unit ?? '',
            status
          }
        });

        if (difference !== 0) {
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { currentStock: new Prisma.Decimal(item.countedStock) }
          });

          await tx.inventoryMovement.create({
            data: {
              ingredientId: item.ingredientId,
              userId: actorId,
              type: difference > 0 ? InventoryMovementType.ADJUSTMENT : InventoryMovementType.WASTE,
              quantity: new Prisma.Decimal(Math.abs(difference)),
              unitCost: ingredient?.averageCost,
              reason: `Conteo ${dto.period}: ${status}. Sistema ${systemStock}, contado ${item.countedStock}.`,
              reference: countItem.id
            }
          });
        }
      }

      return tx.inventoryCount.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: { include: { ingredient: true } } }
      });
    });

    await this.auditService.log({ userId: actorId, action: 'inventory.count.create', entity: 'InventoryCount', entityId: count.id, after: count });
    return count;
  }

  async createMovement(dto: CreateInventoryMovementDto, actorId: string) {
    const ingredient = await this.ensureIngredient(dto.ingredientId);
    const signedQuantity = this.signedQuantity(dto.type, dto.quantity);
    const nextStock = Number(ingredient.currentStock) + signedQuantity;

    if (nextStock < 0) {
      throw new ConflictException('Inventory movement would leave stock below zero');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: dto.ingredientId },
        data: {
          currentStock: new Prisma.Decimal(nextStock),
          averageCost: dto.unitCost ?? undefined
        }
      });

      return tx.inventoryMovement.create({
        data: {
          ingredientId: dto.ingredientId,
          userId: actorId,
          type: dto.type,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          reason: dto.reason,
          reference: dto.reference
        }
      });
    });

    if (dto.type === InventoryMovementType.ADJUSTMENT) {
      await this.auditService.log({
        userId: actorId,
        action: 'inventory.movement.adjustment',
        entity: 'InventoryMovement',
        entityId: result.id,
        before: ingredient,
        after: result,
        metadata: { nextStock }
      });
    }

    return result;
  }

  async consumeOrderItemsInTransaction(tx: Tx, orderItemIds: string[], actorId?: string) {
    if (orderItemIds.length === 0) {
      return;
    }

    const orderItems = await tx.orderItem.findMany({
      where: { id: { in: orderItemIds } },
      include: {
        menuItem: {
          include: {
            recipes: {
              where: { isActive: true },
              include: { ingredient: true }
            }
          }
        }
      }
    });

    for (const orderItem of orderItems) {
      for (const recipe of orderItem.menuItem.recipes) {
        const consumedQuantity = this.convertQuantity(
          Number(recipe.quantity) * orderItem.quantity,
          recipe.unit,
          recipe.ingredient.unit
        );
        const nextStock = Number(recipe.ingredient.currentStock) - consumedQuantity;

        if (nextStock < 0) {
          throw new ConflictException(`Insufficient stock for ${recipe.ingredient.name}`);
        }

        await tx.ingredient.update({
          where: { id: recipe.ingredientId },
          data: { currentStock: new Prisma.Decimal(nextStock) }
        });

        await tx.inventoryMovement.create({
          data: {
            ingredientId: recipe.ingredientId,
            userId: actorId,
            type: InventoryMovementType.CONSUMPTION,
            quantity: new Prisma.Decimal(consumedQuantity),
            unitCost: recipe.ingredient.averageCost,
            reason: `Order item ${orderItem.id}`,
            reference: orderItem.id
          }
        });
      }
    }
  }

  async registerCancelledOrderItemInTransaction(tx: Tx, orderItemId: string, status: OrderItemStatus, actorId?: string) {
    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        menuItem: {
          include: {
            recipes: {
              where: { isActive: true },
              include: { ingredient: true }
            }
          }
        }
      }
    });

    if (!orderItem) {
      return;
    }

    for (const recipe of orderItem.menuItem.recipes) {
      const quantity = this.convertQuantity(
        Number(recipe.quantity) * orderItem.quantity,
        recipe.unit,
        recipe.ingredient.unit
      );

      if (status === OrderItemStatus.SENT) {
        await tx.ingredient.update({
          where: { id: recipe.ingredientId },
          data: { currentStock: new Prisma.Decimal(Number(recipe.ingredient.currentStock) + quantity) }
        });
      }

      await tx.inventoryMovement.create({
        data: {
          ingredientId: recipe.ingredientId,
          userId: actorId,
          type: status === OrderItemStatus.SENT ? InventoryMovementType.RETURN : InventoryMovementType.WASTE,
          quantity: new Prisma.Decimal(quantity),
          unitCost: recipe.ingredient.averageCost,
          reason: status === OrderItemStatus.SENT ? `Return cancelled order item ${orderItem.id}` : `Waste cancelled prepared order item ${orderItem.id}`,
          reference: orderItem.id
        }
      });
    }
  }

  convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
    const normalizedFrom = this.normalizeUnit(fromUnit);
    const normalizedTo = this.normalizeUnit(toUnit);

    if (normalizedFrom === normalizedTo) {
      return quantity;
    }

    if (normalizedFrom === 'kg' && normalizedTo === 'g') {
      return quantity * 1000;
    }

    if (normalizedFrom === 'g' && normalizedTo === 'kg') {
      return quantity / 1000;
    }

    if (normalizedFrom === 'l' && normalizedTo === 'ml') {
      return quantity * 1000;
    }

    if (normalizedFrom === 'ml' && normalizedTo === 'l') {
      return quantity / 1000;
    }

    if (normalizedFrom === 'unit' && normalizedTo === 'unit') {
      return quantity;
    }

    throw new ConflictException(`Cannot convert ${fromUnit} to ${toUnit}`);
  }

  private signedQuantity(type: InventoryMovementType, quantity: number) {
    if (type === InventoryMovementType.CONSUMPTION || type === InventoryMovementType.WASTE) {
      return -quantity;
    }

    return quantity;
  }

  private normalizeUnit(unit: string) {
    const value = unit.trim().toLowerCase();
    const aliases: Record<string, string> = {
      gramo: 'g',
      gramos: 'g',
      gram: 'g',
      grams: 'g',
      g: 'g',
      kilogramo: 'kg',
      kilogramos: 'kg',
      kilo: 'kg',
      kilos: 'kg',
      kg: 'kg',
      mililitro: 'ml',
      mililitros: 'ml',
      milliliter: 'ml',
      milliliters: 'ml',
      ml: 'ml',
      litro: 'l',
      litros: 'l',
      liter: 'l',
      liters: 'l',
      l: 'l',
      unidad: 'unit',
      unidades: 'unit',
      unit: 'unit',
      units: 'unit'
    };

    return aliases[value] ?? value;
  }

  private async ensureUnit(id: string) {
    const unit = await this.prisma.measurementUnit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Measurement unit not found');
    return unit;
  }

  private async ensureSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private async ensureIngredient(id: string) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id }, include: ingredientInclude });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    return ingredient;
  }

  private async ensureRecipe(id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  private async ensureRecipeIngredientIsUnique(menuItemId: string, ingredientId: string, ignoreRecipeId?: string) {
    const duplicate = await this.prisma.recipe.findFirst({
      where: {
        menuItemId,
        ingredientId,
        isActive: true,
        id: ignoreRecipeId ? { not: ignoreRecipeId } : undefined
      }
    });

    if (duplicate) {
      throw new ConflictException('Ingredient already exists in this recipe');
    }
  }

  private async ensureMenuItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }
}
