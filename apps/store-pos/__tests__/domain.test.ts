import {
  canCheckout,
  cartTotalCents,
  nextPaymentState,
  queueSaleIfOffline,
} from '../src/domain';

describe('temporary POS domain rules', () => {
  const safeHealth = { storeOnline: true, deviceOnline: true, paymentsAvailable: true };

  it('blocks checkout when a health prerequisite is unsafe', () => {
    expect(canCheckout([], safeHealth)).toEqual({ allowed: false, reason: 'Add an item before checking out.' });
    expect(canCheckout([{ sku: 'coffee', quantity: 1, priceCents: 325 }], { ...safeHealth, paymentsAvailable: false }))
      .toEqual({ allowed: false, reason: 'Payments terminal is unavailable.' });
  });

  it('calculates cart totals from quantity and unit price', () => {
    expect(cartTotalCents([{ sku: 'coffee', quantity: 2, priceCents: 325 }, { sku: 'water', quantity: 1, priceCents: 175 }])).toBe(825);
  });

  it('makes payment retryable after timeout or decline', () => {
    expect(nextPaymentState('processing', 'timeout')).toBe('timeout');
    expect(nextPaymentState('timeout', 'retry')).toBe('processing');
    expect(nextPaymentState('declined', 'retry')).toBe('processing');
  });

  it('queues only completed sales when offline', () => {
    expect(queueSaleIfOffline({ id: 'sale-1', status: 'approved' }, false)).toHaveLength(1);
    expect(queueSaleIfOffline({ id: 'sale-2', status: 'declined' }, false)).toHaveLength(0);
    expect(queueSaleIfOffline({ id: 'sale-3', status: 'approved' }, true)).toHaveLength(0);
  });
});
