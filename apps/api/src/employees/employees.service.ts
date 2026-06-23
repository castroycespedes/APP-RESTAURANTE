import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';

const employeeSelect = {
  id: true,
  userId: true,
  employeeCode: true,
  documentId: true,
  position: true,
  hiredAt: true,
  terminatedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: {
        select: {
          key: true,
          name: true
        }
      }
    }
  }
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findAll() {
    return this.prisma.employee.findMany({
      select: employeeSelect,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: employeeSelect
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async create(dto: CreateEmployeeDto, actorId: string) {
    await this.ensureUserExists(dto.userId);
    await this.ensureUnique(dto.employeeCode, dto.documentId, dto.userId);

    const employee = await this.prisma.employee.create({
      data: {
        userId: dto.userId,
        employeeCode: dto.employeeCode,
        documentId: dto.documentId,
        position: dto.position
      },
      select: employeeSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.employee.create',
      entity: 'Employee',
      entityId: employee.id,
      after: employee
    });

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, actorId: string) {
    const current = await this.prisma.employee.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.userId) {
      await this.ensureUserExists(dto.userId);
    }

    await this.ensureUnique(dto.employeeCode, dto.documentId, dto.userId, id);

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        userId: dto.userId,
        employeeCode: dto.employeeCode,
        documentId: dto.documentId,
        position: dto.position,
        isActive: dto.isActive,
        terminatedAt: dto.isActive === false ? new Date() : undefined
      },
      select: employeeSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.employee.update',
      entity: 'Employee',
      entityId: id,
      before: current,
      after: employee
    });

    return employee;
  }

  async deactivate(id: string, actorId: string) {
    const current = await this.prisma.employee.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('Employee not found');
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        isActive: false,
        terminatedAt: new Date()
      },
      select: employeeSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.employee.deactivate',
      entity: 'Employee',
      entityId: id,
      before: current,
      after: employee
    });

    return employee;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async ensureUnique(
    employeeCode?: string,
    documentId?: string,
    userId?: string,
    ignoreId?: string
  ) {
    const conditions: Prisma.EmployeeWhereInput[] = [];

    if (employeeCode) {
      conditions.push({ employeeCode });
    }

    if (documentId) {
      conditions.push({ documentId });
    }

    if (userId) {
      conditions.push({ userId });
    }

    if (conditions.length === 0) {
      return;
    }

    const conflicts = await this.prisma.employee.findMany({
      where: {
        OR: conditions,
        NOT: ignoreId ? { id: ignoreId } : undefined
      },
      select: { id: true }
    });

    if (conflicts.length > 0) {
      throw new ConflictException('Employee code, document or user already exists');
    }
  }
}
