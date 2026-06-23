import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

function createService() {
  return new InventoryService({} as never, {} as never);
}

describe('InventoryService unit rules', () => {
  it('converts kg to g and liters to ml', () => {
    const service = createService();

    assert.equal(service.convertQuantity(1.5, 'kg', 'g'), 1500);
    assert.equal(service.convertQuantity(2, 'litros', 'ml'), 2000);
  });

  it('keeps compatible unit quantities unchanged', () => {
    const service = createService();

    assert.equal(service.convertQuantity(3, 'unidad', 'unit'), 3);
    assert.equal(service.convertQuantity(250, 'gramos', 'g'), 250);
  });

  it('rejects unsupported conversions', () => {
    const service = createService();

    assert.throws(() => service.convertQuantity(1, 'g', 'ml'), ConflictException);
  });
});
