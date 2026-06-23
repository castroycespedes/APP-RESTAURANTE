import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ThemeService } from './theme.service';

const baseTheme = {
  id: 'theme-1',
  restaurantName: 'Mi Restaurante',
  logoUrl: null,
  primaryColor: '#0f766e',
  secondaryColor: '#d97706',
  backgroundColor: '#eef2f1',
  textColor: '#17211f',
  buttonColor: '#0f766e',
  cardColor: '#ffffff',
  borderRadius: '8px',
  fontFamily: 'Inter, system-ui, sans-serif',
  darkModeEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('ThemeService', () => {
  it('creates the default theme when none exists', async () => {
    const create = mock.fn(async (input) => ({ id: 'theme-1', ...input.data }));
    const service = new ThemeService(
      {
        appTheme: {
          findFirst: mock.fn(async () => null),
          create
        }
      } as never,
      { log: mock.fn() } as never
    );

    const theme = await service.getCurrentTheme();

    assert.equal(theme.restaurantName, 'Mi Restaurante');
    assert.equal(create.mock.callCount(), 1);
  });

  it('rejects unreadable color combinations', async () => {
    const service = new ThemeService(
      {
        appTheme: {
          findFirst: mock.fn(async () => baseTheme)
        }
      } as never,
      { log: mock.fn() } as never
    );

    await assert.rejects(
      () => service.updateTheme({ backgroundColor: '#ffffff', cardColor: '#ffffff', textColor: '#ffffff' }, 'user-1'),
      BadRequestException
    );
  });
});
