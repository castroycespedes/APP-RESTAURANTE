import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

function createContext(email: string, ip: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body: { email },
        ip,
        headers: {}
      })
    })
  };
}

test('LoginRateLimitGuard blocks repeated attempts for the same email and ip', () => {
  process.env.LOGIN_RATE_LIMIT_MAX = '2';
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';

  const guard = new LoginRateLimitGuard();
  const context = createContext(`rate-${Date.now()}@restaurant.local`, '10.0.0.1') as never;

  assert.equal(guard.canActivate(context), true);
  assert.equal(guard.canActivate(context), true);
  assert.throws(
    () => guard.canActivate(context),
    (error) => error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
  );
});
