import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

const customerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CustomerSelect;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findAll() {
    return this.prisma.customer.findMany({
      select: customerSelect,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: customerSelect
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async create(dto: CreateCustomerDto, actorId: string) {
    const customer = await this.prisma.customer.create({
      data: dto,
      select: customerSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.customer.create',
      entity: 'Customer',
      entityId: customer.id,
      after: customer
    });

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    const current = await this.findOne(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: dto,
      select: customerSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.customer.update',
      entity: 'Customer',
      entityId: id,
      before: current,
      after: customer
    });

    return customer;
  }

  async deactivate(id: string, actorId: string) {
    return this.update(id, { isActive: false }, actorId);
  }
}
