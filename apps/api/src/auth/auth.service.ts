import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from './auth.types';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true }
    });

    if (!user || !user.isActive || !user.role.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.signTokens(authUser);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
        lastLoginAt: new Date()
      }
    });

    return {
      user: authUser,
      ...tokens
    };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh'
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true }
    });

    if (!user?.refreshTokenHash || !user.isActive || !user.role.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.signTokens(this.toAuthUser(user));

    return {
      accessToken: tokens.accessToken,
      refreshToken
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null }
    });

    await this.auditService.log({
      userId,
      action: 'auth.logout',
      entity: 'User',
      entityId: userId
    });

    return { success: true };
  }

  async signTokens(user: AuthUser) {
    const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as JwtSignOptions['expiresIn'];
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn'];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      permissions: user.permissions
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
        expiresIn: accessExpiresIn
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
        expiresIn: refreshExpiresIn
      })
    ]);

    return { accessToken, refreshToken };
  }

  private toAuthUser(user: User & { role: { key: AuthUser['role']; permissions: string[] } }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role.key,
      roleId: user.roleId,
      permissions: user.role.permissions
    };
  }
}
