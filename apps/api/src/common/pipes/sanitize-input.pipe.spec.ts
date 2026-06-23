import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SanitizeInputPipe } from './sanitize-input.pipe';

test('SanitizeInputPipe trims strings and removes html/script content recursively', () => {
  const pipe = new SanitizeInputPipe();
  const result = pipe.transform(
    {
      name: '  <b>Admin</b>  ',
      profile: {
        notes: '<script>alert(1)</script>Hola'
      },
      items: [' <i>Mesa</i> ']
    },
    { type: 'body', metatype: undefined, data: undefined }
  );

  assert.deepEqual(result, {
    name: 'Admin',
    profile: {
      notes: 'Hola'
    },
    items: ['Mesa']
  });
});

test('SanitizeInputPipe does not alter sensitive credential fields', () => {
  const pipe = new SanitizeInputPipe();
  const password = '  <Secret>Admin123!</Secret>  ';
  const result = pipe.transform(
    {
      password,
      refreshToken: '<jwt.token.value>'
    },
    { type: 'body', metatype: undefined, data: undefined }
  );

  assert.deepEqual(result, {
    password,
    refreshToken: '<jwt.token.value>'
  });
});
