import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OrderStatus, Prisma, TableStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { AutoArrangeTablesDto } from './dto/auto-arrange-tables.dto';
import type { CreateDiningAreaDto } from './dto/create-dining-area.dto';
import type { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import type { MoveTableDto } from './dto/move-table.dto';
import type { UpdateDiningAreaDto } from './dto/update-dining-area.dto';
import type { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import type { UpdateTableStatusDto } from './dto/update-table-status.dto';

const tableInclude = {
  diningArea: {
    select: {
      id: true,
      name: true
    }
  },
  assignedWaiter: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  orders: {
    where: {
      status: {
        in: [
          OrderStatus.OPEN,
          OrderStatus.SENT_TO_KITCHEN,
          OrderStatus.PREPARING,
          OrderStatus.READY,
          OrderStatus.SERVED,
          OrderStatus.WAITING_PAYMENT
        ]
      }
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 1
  }
} satisfies Prisma.RestaurantTableInclude;

const OPEN_ORDER_STATUSES = [
  OrderStatus.OPEN,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.WAITING_PAYMENT
];

const TABLE_GRID_COLUMNS = 4;
const TABLE_GRID_START_X = 16;
const TABLE_GRID_START_Y = 22;
const TABLE_GRID_GAP_X = 22;
const TABLE_GRID_GAP_Y = 28;
const TABLE_GRID_MIN_GAP_X = 16;
const TABLE_GRID_MIN_GAP_Y = 20;

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findAreas() {
    return this.prisma.diningArea.findMany({
      include: {
        tables: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { number: 'asc' }]
        },
        _count: {
          select: {
            tables: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async createArea(dto: CreateDiningAreaDto, actorId: string) {
    const area = await this.prisma.diningArea.create({
      data: dto
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.dining-area.create',
      entity: 'DiningArea',
      entityId: area.id,
      after: area
    });

    return area;
  }

  async updateArea(id: string, dto: UpdateDiningAreaDto, actorId: string) {
    const current = await this.ensureAreaExists(id);
    const area = await this.prisma.diningArea.update({
      where: { id },
      data: dto
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.dining-area.update',
      entity: 'DiningArea',
      entityId: id,
      before: current,
      after: area
    });

    return area;
  }

  async deactivateArea(id: string, actorId: string) {
    const current = await this.ensureAreaExists(id);
    const area = await this.prisma.diningArea.update({
      where: { id },
      data: { isActive: false }
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.dining-area.deactivate',
      entity: 'DiningArea',
      entityId: id,
      before: current,
      after: area
    });

    return area;
  }

  findTablesForUser(user: AuthUser) {
    return this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        assignedWaiterId: user.role === UserRole.WAITER ? user.id : undefined
      },
      include: tableInclude,
      orderBy: [{ diningArea: { sortOrder: 'asc' } }, { number: 'asc' }]
    });
  }

  findTablesByArea(areaId: string, user: AuthUser) {
    return this.prisma.restaurantTable.findMany({
      where: {
        diningAreaId: areaId,
        isActive: true,
        assignedWaiterId: user.role === UserRole.WAITER ? user.id : undefined
      },
      include: tableInclude,
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }]
    });
  }

  findMyTables(waiterId: string) {
    return this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        assignedWaiterId: waiterId
      },
      include: tableInclude,
      orderBy: [{ diningArea: { sortOrder: 'asc' } }, { number: 'asc' }, { createdAt: 'asc' }]
    });
  }

  async findWaiterOperationalTables(user: AuthUser) {
    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        assignedWaiterId: user.role === UserRole.WAITER ? user.id : undefined
      },
      include: {
        diningArea: {
          select: { id: true, name: true, sortOrder: true }
        },
        assignedWaiter: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        orders: {
          where: { status: { in: OPEN_ORDER_STATUSES } },
          include: {
            items: {
              select: { id: true, status: true, total: true }
            },
            kitchenTickets: {
              select: { id: true, status: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: [{ diningArea: { sortOrder: 'asc' } }, { number: 'asc' }, { createdAt: 'asc' }]
    });

    const areas = new Map<string, { id: string; name: string; tables: unknown[] }>();

    for (const table of tables) {
      const areaId = table.diningArea.id;
      const order = table.orders[0];
      const pendingItemsCount = order?.items.filter((item) => item.status === 'PENDING').length ?? 0;
      const area = areas.get(areaId) ?? {
        id: areaId,
        name: table.diningArea.name,
        tables: []
      };

      area.tables.push({
        id: table.id,
        name: table.name,
        number: table.number,
        capacity: table.capacity,
        status: table.status,
        shape: table.shape,
        color: table.color,
        posX: table.posX,
        posY: table.posY,
        diningArea: { id: table.diningArea.id, name: table.diningArea.name },
        assignedWaiterId: table.assignedWaiterId,
        assignedWaiter: table.assignedWaiter,
        openOrder: order
          ? {
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              subtotal: order.subtotal,
              total: order.total,
              createdAt: order.createdAt,
              pendingItemsCount,
              kitchenStatus: order.kitchenTickets[0]?.status ?? null
            }
          : null
      });
      areas.set(areaId, area);
    }

    return Array.from(areas.values());
  }

  async findCurrentOrderForTable(tableId: string, user: AuthUser) {
    await this.ensureUserCanAccessTable(tableId, user);

    return this.prisma.order.findFirst({
      where: {
        tableId,
        status: { in: OPEN_ORDER_STATUSES }
      },
      include: {
        table: {
          include: {
            diningArea: { select: { id: true, name: true } },
            assignedWaiter: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        waiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, price: true, imageUrl: true, preparationTimeMinutes: true } },
            modifiers: true
          },
          orderBy: { createdAt: 'asc' }
        },
        kitchenTickets: {
          include: { items: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTable(dto: CreateRestaurantTableDto, actorId: string) {
    await this.ensureAreaExists(dto.diningAreaId);
    await this.ensureWaiterCanBeAssigned(dto.assignedWaiterId);
    const tableIdentity = await this.resolveTableIdentity(dto);
    const tablePosition = dto.posX !== undefined && dto.posY !== undefined
      ? { posX: dto.posX, posY: dto.posY }
      : await this.calculateNextTablePosition(dto.diningAreaId);

    const table = await this.prisma.restaurantTable.create({
      data: { ...dto, ...tableIdentity, ...tablePosition },
      include: tableInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.table.create',
      entity: 'RestaurantTable',
      entityId: table.id,
      after: table
    });

    return table;
  }

  private async calculateNextTablePosition(diningAreaId: string) {
    const existingTables = await this.prisma.restaurantTable.findMany({
      where: {
        diningAreaId,
        isActive: true
      },
      select: {
        posX: true,
        posY: true
      },
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }]
    });

    for (let index = 0; index < 200; index += 1) {
      const candidate = this.gridPositionForIndex(index);
      const hasCollision = existingTables.some((table) =>
        Math.abs(table.posX - candidate.posX) < TABLE_GRID_MIN_GAP_X &&
        Math.abs(table.posY - candidate.posY) < TABLE_GRID_MIN_GAP_Y
      );

      if (!hasCollision) {
        return candidate;
      }
    }

    return this.gridPositionForIndex(existingTables.length);
  }

  private gridPositionForIndex(index: number) {
    const column = index % TABLE_GRID_COLUMNS;
    const row = Math.floor(index / TABLE_GRID_COLUMNS);

    return {
      posX: TABLE_GRID_START_X + column * TABLE_GRID_GAP_X,
      posY: TABLE_GRID_START_Y + row * TABLE_GRID_GAP_Y
    };
  }

  private async resolveTableIdentity(dto: CreateRestaurantTableDto) {
    const existingTables = await this.prisma.restaurantTable.findMany({
      where: { diningAreaId: dto.diningAreaId },
      select: {
        name: true,
        number: true
      }
    });
    const existingNames = new Set(existingTables.map((table) => table.name.trim().toLowerCase()));
    const existingNumbers = new Set(existingTables.map((table) => table.number.trim().toLowerCase()));
    const nextNumber = dto.number?.trim() || this.nextAvailableTableNumber(existingTables.map((table) => table.number));
    const nextName = dto.name?.trim() || `Mesa ${nextNumber}`;

    if (existingNumbers.has(nextNumber.toLowerCase())) {
      throw new ConflictException('Table number already exists in this area');
    }

    if (existingNames.has(nextName.toLowerCase())) {
      throw new ConflictException('Table name already exists in this area');
    }

    return {
      name: nextName,
      number: nextNumber
    };
  }

  private nextAvailableTableNumber(numbers: string[]) {
    const usedNumbers = new Set(
      numbers
        .map((number) => Number(number))
        .filter((number) => Number.isInteger(number) && number > 0)
    );
    let candidate = 1;

    while (usedNumbers.has(candidate)) {
      candidate += 1;
    }

    return String(candidate);
  }

  async updateTable(id: string, dto: UpdateRestaurantTableDto, actorId: string) {
    const current = await this.ensureTableExists(id);

    if (dto.diningAreaId) {
      await this.ensureAreaExists(dto.diningAreaId);
    }

    if (dto.assignedWaiterId) {
      await this.ensureWaiterCanBeAssigned(dto.assignedWaiterId);
    }

    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: dto,
      include: tableInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.table.update',
      entity: 'RestaurantTable',
      entityId: id,
      before: current,
      after: table
    });

    return table;
  }

  async moveTable(id: string, dto: MoveTableDto, actorId: string) {
    return this.updateTable(id, dto, actorId);
  }

  async updateTableStatus(id: string, dto: UpdateTableStatusDto, actorId: string) {
    const current = await this.ensureTableExists(id);
    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: { status: dto.status },
      include: tableInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.table.status-update',
      entity: 'RestaurantTable',
      entityId: id,
      before: current,
      after: table
    });

    return table;
  }

  async autoArrangeTables(dto: AutoArrangeTablesDto, actorId: string) {
    if (dto.areaId) {
      await this.ensureAreaExists(dto.areaId);
    }

    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        diningAreaId: dto.areaId
      },
      select: {
        id: true,
        diningAreaId: true,
        number: true,
        createdAt: true,
        posX: true,
        posY: true
      },
      orderBy: [{ diningAreaId: 'asc' }, { number: 'asc' }, { createdAt: 'asc' }]
    });

    const tablesByArea = new Map<string, typeof tables>();

    for (const table of tables) {
      const areaTables = tablesByArea.get(table.diningAreaId) ?? [];
      areaTables.push(table);
      tablesByArea.set(table.diningAreaId, areaTables);
    }

    const updates = Array.from(tablesByArea.values()).flatMap((areaTables) =>
      areaTables
        .sort((left, right) => this.compareTableNumbers(left.number, right.number) || left.createdAt.getTime() - right.createdAt.getTime())
        .map((table, index) => ({
          id: table.id,
          before: { posX: table.posX, posY: table.posY },
          after: this.gridPositionForIndex(index)
        }))
    );

    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.restaurantTable.update({
          where: { id: update.id },
          data: update.after
        })
      )
    );

    await this.auditService.log({
      userId: actorId,
      action: 'admin.table.auto-arrange',
      entity: 'RestaurantTable',
      after: {
        areaId: dto.areaId ?? null,
        updatedTables: updates
      }
    });

    return this.prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        diningAreaId: dto.areaId
      },
      include: tableInclude,
      orderBy: [{ diningArea: { sortOrder: 'asc' } }, { number: 'asc' }, { createdAt: 'asc' }]
    });
  }

  async assignWaiter(id: string, waiterId: string | undefined, actorId: string) {
    const current = await this.ensureTableExists(id);
    await this.ensureWaiterCanBeAssigned(waiterId);

    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: { assignedWaiterId: waiterId ?? null },
      include: tableInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.table.assign-waiter',
      entity: 'RestaurantTable',
      entityId: id,
      before: current,
      after: table
    });

    return table;
  }

  async deactivateTable(id: string, actorId: string) {
    const current = await this.ensureTableExists(id);
    const table = await this.prisma.restaurantTable.update({
      where: { id },
      data: { isActive: false },
      include: tableInclude
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.table.deactivate',
      entity: 'RestaurantTable',
      entityId: id,
      before: current,
      after: table
    });

    return table;
  }

  async openOrderForAssignedTable(tableId: string, waiterId: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
      include: tableInclude
    });

    if (!table || !table.isActive) {
      throw new NotFoundException('Table not found');
    }

    if (table.assignedWaiterId !== waiterId) {
      throw new ForbiddenException('Waiter can only open orders on assigned tables');
    }

    if (table.status !== TableStatus.AVAILABLE) {
      throw new ConflictException('Only available assigned tables can be opened');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          tableId,
          waiterId,
          status: OrderStatus.OPEN
        }
      });

      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.OCCUPIED }
      });

      return order;
    });
  }

  private async ensureAreaExists(id: string) {
    const area = await this.prisma.diningArea.findUnique({ where: { id } });

    if (!area) {
      throw new NotFoundException('Dining area not found');
    }

    return area;
  }

  private async ensureTableExists(id: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
      include: tableInclude
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  private async ensureUserCanAccessTable(tableId: string, user: AuthUser) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id: tableId } });

    if (!table || !table.isActive) {
      throw new NotFoundException('Table not found');
    }

    if (user.role === UserRole.WAITER && table.assignedWaiterId !== user.id) {
      throw new ForbiddenException('Waiter can only operate assigned tables');
    }

    return table;
  }

  private compareTableNumbers(left: string, right: string) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right, 'es', { numeric: true });
  }

  private async ensureWaiterCanBeAssigned(waiterId?: string) {
    if (!waiterId) {
      return;
    }

    const waiter = await this.prisma.user.findUnique({
      where: { id: waiterId },
      include: { role: true }
    });

    if (!waiter || !waiter.isActive || waiter.role.key !== UserRole.WAITER) {
      throw new NotFoundException('Assigned waiter not found');
    }
  }
}
