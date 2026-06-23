import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
  roleId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      key: true,
      name: true,
      permissions: true
    }
  }
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const role = await this.prisma.role.findUnique({ where: { key: dto.role } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.ensureUnique(dto.email, dto.username);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 12),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: role.id
      },
      select: userSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.user.create',
      entity: 'User',
      entityId: user.id,
      after: user
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const current = await this.prisma.user.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('User not found');
    }

    await this.ensureUnique(dto.email, dto.username, id);

    const role = dto.role ? await this.prisma.role.findUnique({ where: { key: dto.role } }) : undefined;

    if (dto.role && !role) {
      throw new NotFoundException('Role not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 12) : undefined,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: role?.id,
        isActive: dto.isActive,
        refreshTokenHash: dto.password || dto.isActive === false ? null : undefined
      },
      select: userSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.user.update',
      entity: 'User',
      entityId: id,
      before: this.toSafeAuditUser(current),
      after: user
    });

    return user;
  }

  async deactivate(id: string, actorId: string) {
    const current = await this.prisma.user.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        refreshTokenHash: null
      },
      select: userSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.user.deactivate',
      entity: 'User',
      entityId: id,
      before: this.toSafeAuditUser(current),
      after: user
    });

    return user;
  }

  private async ensureUnique(email?: string, username?: string, ignoreId?: string) {
    const conditions: Prisma.UserWhereInput[] = [];

    if (email) {
      conditions.push({ email });
    }

    if (username) {
      conditions.push({ username });
    }

    if (conditions.length === 0) {
      return;
    }

    const conflicts = await this.prisma.user.findMany({
      where: {
        OR: conditions,
        NOT: ignoreId ? { id: ignoreId } : undefined
      },
      select: { id: true }
    });

    if (conflicts.length > 0) {
      throw new ConflictException('Email or username already exists');
    }
  }

  private toSafeAuditUser(user: User) {
    return {
      id: user.id,
      roleId: user.roleId,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
