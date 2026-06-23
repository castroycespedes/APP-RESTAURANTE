import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSettingDto } from './dto/create-setting.dto';
import type { UpdateSettingDto } from './dto/update-setting.dto';
import type { BulkUpsertSettingsDto } from './dto/bulk-upsert-settings.dto';

const settingSelect = {
  id: true,
  key: true,
  label: true,
  value: true,
  description: true,
  group: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AppSettingSelect;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  findAll() {
    return this.prisma.appSetting.findMany({
      select: settingSelect,
      orderBy: [{ group: 'asc' }, { label: 'asc' }]
    });
  }

  async create(dto: CreateSettingDto, actorId: string) {
    const setting = await this.prisma.appSetting.create({
      data: {
        key: dto.key,
        label: dto.label,
        value: dto.value,
        description: dto.description,
        group: dto.group,
        isActive: dto.isActive
      },
      select: settingSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.setting.create',
      entity: 'AppSetting',
      entityId: setting.id,
      after: setting
    });

    return setting;
  }

  async bulkUpsert(dto: BulkUpsertSettingsDto, actorId: string) {
    const currentSettings = await this.prisma.appSetting.findMany({
      where: {
        key: {
          in: dto.settings.map((setting) => setting.key)
        }
      },
      select: settingSelect
    });

    const settings = await this.prisma.$transaction(
      dto.settings.map((setting) =>
        this.prisma.appSetting.upsert({
          where: { key: setting.key },
          update: {
            label: setting.label,
            value: setting.value,
            description: setting.description,
            group: setting.group,
            isActive: setting.isActive
          },
          create: {
            key: setting.key,
            label: setting.label,
            value: setting.value,
            description: setting.description,
            group: setting.group,
            isActive: setting.isActive
          },
          select: settingSelect
        })
      )
    );

    await this.auditService.log({
      userId: actorId,
      action: 'admin.setting.bulk-upsert',
      entity: 'AppSetting',
      entityId: 'bulk',
      before: currentSettings,
      after: settings
    });

    return settings;
  }

  async update(id: string, dto: UpdateSettingDto, actorId: string) {
    const current = await this.ensureSetting(id);
    const setting = await this.prisma.appSetting.update({
      where: { id },
      data: dto,
      select: settingSelect
    });

    await this.auditService.log({
      userId: actorId,
      action: 'admin.setting.update',
      entity: 'AppSetting',
      entityId: id,
      before: current,
      after: setting
    });

    return setting;
  }

  async deactivate(id: string, actorId: string) {
    return this.update(id, { isActive: false }, actorId);
  }

  private async ensureSetting(id: string) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { id },
      select: settingSelect
    });

    if (!setting) {
      throw new NotFoundException('Setting not found');
    }

    return setting;
  }
}
