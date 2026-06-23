import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface LoginAttemptBucket {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, LoginAttemptBucket>();

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly maxAttempts = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5);
  private readonly windowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      body?: { email?: string };
      ip?: string;
      socket?: { remoteAddress?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const key = this.createKey(request);
    const now = Date.now();
    const current = attempts.get(key);

    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (current.count >= this.maxAttempts) {
      const waitSeconds = Math.ceil((current.resetAt - now) / 1000);
      throw new HttpException(
        `Too many login attempts. Try again in ${waitSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    current.count += 1;
    return true;
  }

  private createKey(request: {
    body?: { email?: string };
    ip?: string;
    socket?: { remoteAddress?: string };
    headers?: Record<string, string | string[] | undefined>;
  }) {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const ipFromHeader = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
    const ip = ipFromHeader?.trim() || request.ip || request.socket?.remoteAddress || 'unknown';
    const email = request.body?.email?.trim().toLowerCase() || 'unknown';

    return `${ip}:${email}`;
  }
}
