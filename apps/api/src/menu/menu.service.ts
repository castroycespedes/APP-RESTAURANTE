import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import type { CreateMenuItemModifierDto } from './dto/create-menu-item-modifier.dto';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto';
import type { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import type { UpdateMenuItemModifierDto } from './dto/update-menu-item-modifier.dto';
import type { UpdateMenuItemDto } from './dto/update-menu-item.dto';

const categoryInclude = {
  parent: {
    select: {
      id: true,
      name: true
    }
  },
  children: {
    select: {
      id: true,
      name: true,
      isActive: true
    },
    orderBy: {
      sortOrder: 'asc'
    }
  }
} satisfies Prisma.MenuCategoryInclude;

const itemInclude = {
  category: {
    select: {
      id: true,
      name: true,
      parentId: true
    }
  },
  modifiers: {
    orderBy: {
      createdAt: 'asc'
    }
  }
} satisfies Prisma.MenuItemInclude;

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async findAvailable() {
    const hideSoldOut = await this.getBooleanSetting('hide_sold_out_for_waiters', true);

    return this.prisma.menuCategory.findMany({
      where: {
        isActive: true,
        parentId: null,
        OR: [
          {
            items: {
              some: {
                isActive: true,
                isAvailable: hideSoldOut ? true : undefined,
                showForWaiters: true
              }
            }
          },
          {
            children: {
              some: {
                isActive: true,
                items: {
                  some: {
                    isActive: true,
                    isAvailable: hideSoldOut ? true : undefined,
                    showForWaiters: true
                  }
                }
              }
            }
          }
        ]
      },
      include: {
        children: {
          where: { isActive: true },
          include: {
            items: {
              where: { isActive: true, isAvailable: hideSoldOut ? true : undefined, showForWaiters: true },
              include: {
                modifiers: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'asc' }
                }
              },
              orderBy: { name: 'asc' }
            }
          },
          orderBy: { sortOrder: 'asc' }
        },
        items: {
          where: { isActive: true, isAvailable: hideSoldOut ? true : undefined, showForWaiters: true },
          include: {
            modifiers: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  findActiveSubcategories(categoryId: string) {
    return this.prisma.menuCategory.findMany({
      where: {
        parentId: categoryId,
        isActive: true
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async findAvailableItemsByCategory(categoryId: string) {
    const hideSoldOut = await this.getBooleanSetting('hide_sold_out_for_waiters', true);

    return this.prisma.menuItem.findMany({
      where: {
        categoryId,
        isActive: true,
        isAvailable: hideSoldOut ? true : undefined,
        showForWaiters: true
      },
      include: {
        modifiers: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        },
        category: {
          select: {
            id: true,
            name: true,
            parentId: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findApplicableModifiers(menuItemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        modifiers: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!item || !item.isActive || !item.showForWaiters) {
      throw new NotFoundException('Available menu item not found');
    }

    return {
      data: item.modifiers.map((modifier) => ({
        id: modifier.id,
        menuItemId: modifier.menuItemId,
        name: modifier.name,
        price: Number(modifier.priceDelta),
        isRequired: modifier.isRequired,
        maxSelections: modifier.maxQuantity,
        scope: {
          productId: item.id,
          productName: item.name,
          categoryId: item.category.parentId ?? item.category.id,
          categoryName: item.category.parent?.name ?? item.category.name,
          subcategoryId: item.category.parentId ? item.category.id : null,
          subcategoryName: item.category.parentId ? item.category.name : null
        }
      })),
      message: item.modifiers.length === 0 ? 'Este producto no tiene adicionales configurados.' : undefined
    };
  }

  findPublicMenu(showSoldOut = false) {
    return this.prisma.menuCategory.findMany({
      where: {
        isActive: true,
        items: {
          some: {
            isActive: true,
            showInPublicMenu: true,
            isAvailable: showSoldOut ? undefined : true
          }
        }
      },
      include: {
        items: {
          where: {
            isActive: true,
            showInPublicMenu: true,
            isAvailable: showSoldOut ? undefined : true
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  findAllCategories() {
    return this.prisma.menuCategory.findMany({
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async createCategory(dto: CreateMenuCategoryDto, actorId: string) {
    if (dto.parentId) {
      await this.ensureCategoryExists(dto.parentId);
    }

    const category = await this.prisma.menuCategory.create({
      data: {
        parentId: dto.parentId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder
      },
      include: categoryInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.category.create',
      entity: 'MenuCategory',
      entityId: category.id,
      after: category
    });

    return category;
  }

  async updateCategory(id: string, dto: UpdateMenuCategoryDto, actorId: string) {
    const current = await this.ensureCategoryExists(id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }

      await this.ensureCategoryExists(dto.parentId);
    }

    const category = await this.prisma.menuCategory.update({
      where: { id },
      data: {
        parentId: dto.parentId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive
      },
      include: categoryInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.category.update',
      entity: 'MenuCategory',
      entityId: id,
      before: current,
      after: category
    });

    return category;
  }

  async deactivateCategory(id: string, actorId: string) {
    const current = await this.ensureCategoryExists(id);
    const category = await this.prisma.menuCategory.update({
      where: { id },
      data: { isActive: false },
      include: categoryInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.category.deactivate',
      entity: 'MenuCategory',
      entityId: id,
      before: current,
      after: category
    });

    return category;
  }

  findAllItems() {
    return this.prisma.menuItem.findMany({
      include: itemInclude,
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });
  }

  async createItem(dto: CreateMenuItemDto, actorId: string) {
    await this.ensureCategoryExists(dto.categoryId);

    const item = await this.prisma.menuItem.create({
      data: {
        categoryId: dto.categoryId,
        type: dto.type,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        price: dto.price,
        imageUrl: dto.imageUrl,
        preparationTimeMinutes: dto.preparationTimeMinutes,
        isAvailable: dto.isAvailable,
        showInPublicMenu: dto.showInPublicMenu,
        showForWaiters: dto.showForWaiters
      },
      include: itemInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.item.create',
      entity: 'MenuItem',
      entityId: item.id,
      after: item
    });

    return item;
  }

  async updateItem(id: string, dto: UpdateMenuItemDto, actorId: string) {
    const current = await this.ensureItemExists(id);

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        type: dto.type,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        price: dto.price,
        imageUrl: dto.imageUrl,
        preparationTimeMinutes: dto.preparationTimeMinutes,
        isAvailable: dto.isAvailable,
        isActive: dto.isActive,
        showInPublicMenu: dto.showInPublicMenu,
        showForWaiters: dto.showForWaiters
      },
      include: itemInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.item.update',
      entity: 'MenuItem',
      entityId: id,
      before: current,
      after: item
    });

    if (dto.price !== undefined && Number(current.price) !== Number(dto.price)) {
      await this.auditService.log({
        userId: actorId,
        action: 'admin.menu.item.price.update',
        entity: 'MenuItem',
        entityId: id,
        before: { price: current.price },
        after: { price: item.price }
      });
    }

    if (dto.isAvailable === false && current.isAvailable) {
      await this.auditService.log({
        userId: actorId,
        action: 'admin.menu.item.mark-sold-out',
        entity: 'MenuItem',
        entityId: id,
        before: { isAvailable: current.isAvailable },
        after: { isAvailable: item.isAvailable }
      });
    }

    return item;
  }

  async deactivateItem(id: string, actorId: string) {
    const current = await this.ensureItemExists(id);
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
      include: itemInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.item.deactivate',
      entity: 'MenuItem',
      entityId: id,
      before: current,
      after: item
    });

    return item;
  }

  findAllModifiers() {
    return this.prisma.menuItemModifier.findMany({
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: [{ menuItem: { name: 'asc' } }, { name: 'asc' }]
    });
  }

  async createModifier(dto: CreateMenuItemModifierDto, actorId: string) {
    await this.ensureItemExists(dto.menuItemId);

    const modifier = await this.prisma.menuItemModifier.create({
      data: {
        menuItemId: dto.menuItemId,
        name: dto.name,
        priceDelta: dto.priceDelta,
        isRequired: dto.isRequired,
        maxQuantity: dto.maxQuantity
      }
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.modifier.create',
      entity: 'MenuItemModifier',
      entityId: modifier.id,
      after: modifier
    });

    return modifier;
  }

  async updateModifier(id: string, dto: UpdateMenuItemModifierDto, actorId: string) {
    const current = await this.ensureModifierExists(id);

    if (dto.menuItemId) {
      await this.ensureItemExists(dto.menuItemId);
    }

    const modifier = await this.prisma.menuItemModifier.update({
      where: { id },
      data: {
        menuItemId: dto.menuItemId,
        name: dto.name,
        priceDelta: dto.priceDelta,
        isRequired: dto.isRequired,
        maxQuantity: dto.maxQuantity,
        isActive: dto.isActive
      }
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.modifier.update',
      entity: 'MenuItemModifier',
      entityId: id,
      before: current,
      after: modifier
    });

    return modifier;
  }

  async deactivateModifier(id: string, actorId: string) {
    const current = await this.ensureModifierExists(id);
    const modifier = await this.prisma.menuItemModifier.update({
      where: { id },
      data: { isActive: false }
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.menu.modifier.deactivate',
      entity: 'MenuItemModifier',
      entityId: id,
      before: current,
      after: modifier
    });

    return modifier;
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.menuCategory.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Menu category not found');
    }

    return category;
  }

  private async ensureItemExists(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return item;
  }

  private async ensureModifierExists(id: string) {
    const modifier = await this.prisma.menuItemModifier.findUnique({ where: { id } });

    if (!modifier) {
      throw new NotFoundException('Menu item modifier not found');
    }

    return modifier;
  }

  private async getBooleanSetting(key: string, fallback: boolean) {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });

    if (!setting || setting.isActive === false) {
      return fallback;
    }

    return setting.value === 'true';
  }
}
