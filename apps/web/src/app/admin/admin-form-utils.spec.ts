import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStrongTemporaryPassword, parseApiResponse } from './admin-form-utils';

describe('admin form validation', () => {
  it('accepts strong temporary passwords', () => {
    assert.equal(isStrongTemporaryPassword('Mesero123!'), true);
    assert.equal(isStrongTemporaryPassword('Admin123!'), true);
  });

  it('rejects weak temporary passwords', () => {
    assert.equal(isStrongTemporaryPassword('mesero123'), false);
    assert.equal(isStrongTemporaryPassword('MESERO123!'), false);
    assert.equal(isStrongTemporaryPassword('Meseroooo!'), false);
    assert.equal(isStrongTemporaryPassword('Mesero123'), false);
  });

  it('parses api validation messages for form feedback', async () => {
    const response = new Response(JSON.stringify({ message: ['email must be an email', 'password is not strong enough'] }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });

    await assert.rejects(
      parseApiResponse(response),
      /email must be an email, password is not strong enough/
    );
  });

  it('returns typed successful api payloads', async () => {
    const response = new Response(JSON.stringify({ id: 'user-1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });

    assert.deepEqual(await parseApiResponse<{ id: string }>(response), { id: 'user-1' });
  });
});
