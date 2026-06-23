import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a valid email and password', async () => {
    const dto = new LoginDto();
    dto.email = 'admin@restaurant.local';
    dto.password = 'Admin123!';

    const errors = await validate(dto);

    assert.equal(errors.length, 0);
  });

  it('rejects invalid login payloads', async () => {
    const dto = new LoginDto();
    dto.email = 'not-an-email';
    dto.password = 'short';

    const errors = await validate(dto);

    assert.equal(errors.length, 2);
  });
});
