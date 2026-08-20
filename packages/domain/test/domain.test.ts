import { describe, expect, it } from 'vitest';
import {
  addMoney,
  assessInventoryRisk,
  calculateCartTotals,
  canCheckout,
  createSeededFixtures,
  enqueueOfflineSale,
  nextPaymentState,
  parseMoney,
  productSchema,
  summarizeStoreHealth,
} from '../src/index.js';

describe('money', () => {
  it('adds integer minor units and rejects unsafe money input', () => {
    expect(addMoney({ currency: 'USD', minor: 199 }, { currency: 'USD', minor: 1 })).toEqual({
      currency: 'USD',
      minor: 200,
    });
    expect(() => parseMoney({ currency: 'USD', minor: 1.5 })).toThrow();
    expect(() => addMoney({ currency: 'USD', minor: 1 }, { currency: 'EUR', minor: 1 })).toThrow();
  });
});

describe('products and inventory', () => {
  it('validates products and classifies stock using target and critical thresholds', () => {
    expect(
      productSchema.safeParse({
        id: 'sku-water',
        name: 'Water',
        price: { currency: 'USD', minor: 150 },
        active: true,
      }).success,
    ).toBe(true);
    expect(
      productSchema.safeParse({ id: '', name: 'Water', price: { currency: 'USD', minor: 150 }, active: true })
        .success,
    ).toBe(false);
    expect(assessInventoryRisk({ productId: 'sku-water', onHand: 2, target: 10, critical: 3 })).toMatchObject(
      { level: 'critical', fillPercent: 20, suggestedFill: 8 },
    );
    expect(assessInventoryRisk({ productId: 'sku-water', onHand: 7, target: 10, critical: 3 }).level).toBe(
      'low',
    );
    expect(
      assessInventoryRisk({ productId: 'sku-water', onHand: 12, target: 10, critical: 3 }),
    ).toMatchObject({ level: 'healthy', suggestedFill: 0 });
  });
});

describe('store health and checkout', () => {
  it('blocks checkout for stale stores and required offline devices', () => {
    const unsafe = summarizeStoreHealth({
      now: '2026-01-01T12:00:00.000Z',
      staleAfterMinutes: 5,
      devices: [
        {
          id: 'reader',
          kind: 'payment-reader',
          requiredForCheckout: true,
          status: 'offline',
          lastSeenAt: '2026-01-01T11:59:00.000Z',
        },
      ],
    });
    expect(unsafe.status).toBe('unsafe');
    expect(canCheckout({ store: unsafe, cartLines: 1 })).toEqual({
      allowed: false,
      reason: 'required-device-offline',
    });

    const stale = summarizeStoreHealth({
      now: '2026-01-01T12:00:00.000Z',
      staleAfterMinutes: 5,
      devices: [],
    });
    expect(canCheckout({ store: stale, cartLines: 1 })).toEqual({
      allowed: false,
      reason: 'store-data-stale',
    });
    expect(
      canCheckout({
        store: { ...unsafe, status: 'healthy', stale: false, offlineRequiredDeviceIds: [] },
        cartLines: 0,
      }),
    ).toEqual({ allowed: false, reason: 'cart-empty' });
  });
});

describe('cart totals', () => {
  it('uses line quantities, discounts, and non-negative tax rates without floats', () => {
    expect(
      calculateCartTotals({
        currency: 'USD',
        taxBasisPoints: 825,
        lines: [
          { productId: 'a', unitPrice: { currency: 'USD', minor: 199 }, quantity: 2, discountMinor: 50 },
          { productId: 'b', unitPrice: { currency: 'USD', minor: 100 }, quantity: 1, discountMinor: 0 },
        ],
      }),
    ).toEqual({
      subtotal: { currency: 'USD', minor: 498 },
      discount: { currency: 'USD', minor: 50 },
      tax: { currency: 'USD', minor: 37 },
      total: { currency: 'USD', minor: 485 },
    });
  });
});

describe('payment and offline queue', () => {
  it('accepts only valid payment transitions and idempotently queues completed offline sales', () => {
    expect(nextPaymentState('processing', { type: 'approved' })).toBe('approved');
    expect(() => nextPaymentState('approved', { type: 'declined', reason: 'late response' })).toThrow();
    const queue = enqueueOfflineSale([], {
      id: 'sale-1',
      completedAt: '2026-01-01T12:00:00.000Z',
      total: { currency: 'USD', minor: 485 },
      paymentState: 'approved',
    });
    const firstSale = queue[0];
    expect(firstSale).toBeDefined();
    if (!firstSale) throw new Error('Expected a queued sale.');
    expect(enqueueOfflineSale(queue, firstSale)).toHaveLength(1);
  });
});

describe('fixtures', () => {
  it('are deterministic for a seed and vary across seeds', () => {
    expect(createSeededFixtures('demo-1')).toEqual(createSeededFixtures('demo-1'));
    expect(createSeededFixtures('demo-1')).not.toEqual(createSeededFixtures('demo-2'));
  });
});
