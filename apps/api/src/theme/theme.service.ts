import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SaveLogoDto } from './dto/save-logo.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { defaultTheme } from './theme.defaults';

const MIN_READABLE_CONTRAST = 4.5;

@Injectable()
export class ThemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getCurrentTheme() {
    const theme = await this.prisma.appTheme.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (theme) return theme;

    return this.prisma.appTheme.create({
      data: defaultTheme
    });
  }

  async updateTheme(dto: UpdateThemeDto, actorId: string) {
    const current = await this.getCurrentTheme();
    const nextTheme = { ...current, ...dto };
    this.assertReadableTheme(nextTheme.backgroundColor, nextTheme.textColor, nextTheme.cardColor);

    const updated = await this.prisma.appTheme.update({
      where: { id: current.id },
      data: dto
    });

    await this.auditService.log({
      userId: actorId,
      action: 'theme.update',
      entity: 'AppTheme',
      entityId: updated.id,
      before: toAuditJson(current),
      after: toAuditJson(updated)
    });

    return updated;
  }

  async saveLogo(dto: SaveLogoDto, actorId: string) {
    return this.updateTheme({ logoUrl: dto.logoUrl ?? null }, actorId);
  }

  async restoreDefault(actorId: string) {
    const current = await this.getCurrentTheme();
    const restored = await this.prisma.appTheme.update({
      where: { id: current.id },
      data: defaultTheme
    });

    await this.auditService.log({
      userId: actorId,
      action: 'theme.restore_default',
      entity: 'AppTheme',
      entityId: restored.id,
      before: toAuditJson(current),
      after: toAuditJson(restored)
    });

    return restored;
  }

  private assertReadableTheme(backgroundColor: string, textColor: string, cardColor: string) {
    const pageContrast = contrastRatio(backgroundColor, textColor);
    const cardContrast = contrastRatio(cardColor, textColor);

    if (pageContrast < MIN_READABLE_CONTRAST || cardContrast < MIN_READABLE_CONTRAST) {
      throw new BadRequestException('La combinacion de colores no cumple contraste minimo de lectura.');
    }
  }
}

function contrastRatio(firstHex: string, secondHex: string) {
  const first = relativeLuminance(hexToRgb(firstHex));
  const second = relativeLuminance(hexToRgb(secondHex));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(rgb: [number, number, number]) {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((character) => character + character).join('')
    : normalized;

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
}

function toAuditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
