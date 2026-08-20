import {
  calculateCartTotals,
  enqueueOfflineSale,
  canCheckout as evaluateCheckout,
  type PaymentEvent as SharedPaymentEvent,
  type PaymentState as SharedPaymentState,
  type StoreHealthSummary,
  nextPaymentState as transitionPayment,
} from '@retail-reliability/domain';

/** React Native adapter types. Shared business rules remain in packages/domain. */
export type CartLine = { sku: string; quantity: number; priceCents: number };
export type Health = { storeOnline: boolean; deviceOnline: boolean; paymentsAvailable: boolean };
export type PaymentState = 'idle' | 'processing' | 'approved' | 'declined' | 'timeout';
export type PaymentEvent = 'start' | 'approve' | 'decline' | 'timeout' | 'retry' | 'reset';
export type CompletedSale = { id: string; status: 'approved' | 'declined' };

export const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const cartTotalCents = (lines: CartLine[]) =>
  calculateCartTotals({
    currency: 'USD',
    taxBasisPoints: 0,
    lines: lines.map((line) => ({
      productId: line.sku,
      quantity: line.quantity,
      unitPrice: { currency: 'USD', minor: line.priceCents },
      discountMinor: 0,
    })),
  }).total.minor;

const toStoreHealth = (health: Health): StoreHealthSummary => {
  const offlineRequiredDeviceIds = [
    ...(!health.deviceOnline ? ['scanner'] : []),
    ...(!health.paymentsAvailable ? ['payment-reader'] : []),
  ];
  return {
    status: offlineRequiredDeviceIds.length ? 'unsafe' : health.storeOnline ? 'healthy' : 'stale',
    stale: !health.storeOnline,
    offlineRequiredDeviceIds,
    degradedDeviceIds: [],
  };
};

export const canCheckout = (lines: CartLine[], health: Health) => {
  const result = evaluateCheckout({ store: toStoreHealth(health), cartLines: lines.length });
  if (result.allowed) return { allowed: true, reason: '' } as const;

  const messages = {
    'cart-empty': 'Add an item before checking out.',
    'store-data-stale': 'Store connection is offline.',
    'required-device-offline': !health.deviceOnline
      ? 'Scanner device needs attention.'
      : 'Payments terminal is unavailable.',
  } as const;
  return { allowed: false, reason: messages[result.reason] } as const;
};

const stateToShared: Record<PaymentState, SharedPaymentState> = {
  idle: 'idle',
  processing: 'processing',
  approved: 'approved',
  declined: 'declined',
  timeout: 'timed-out',
};
const stateFromShared: Record<SharedPaymentState, PaymentState> = {
  idle: 'idle',
  processing: 'processing',
  approved: 'approved',
  declined: 'declined',
  'timed-out': 'timeout',
};

const toSharedEvent = (event: PaymentEvent): SharedPaymentEvent => {
  switch (event) {
    case 'start':
      return { type: 'started' };
    case 'approve':
      return { type: 'approved' };
    case 'decline':
      return { type: 'declined', reason: 'Deterministic demo decline' };
    case 'timeout':
      return { type: 'timed-out' };
    case 'retry':
      return { type: 'retry' };
    case 'reset':
      return { type: 'reset' };
  }
};

export const nextPaymentState = (state: PaymentState, event: PaymentEvent): PaymentState => {
  try {
    return stateFromShared[transitionPayment(stateToShared[state], toSharedEvent(event))];
  } catch {
    return state;
  }
};

export const queueSaleIfOffline = (sale: CompletedSale, online: boolean) => {
  if (online || sale.status !== 'approved') return [];
  const queue = enqueueOfflineSale([], {
    id: sale.id,
    completedAt: '2026-01-01T12:00:00.000Z',
    total: { currency: 'USD', minor: 0 },
    paymentState: 'approved',
  });
  return queue.map(({ id, paymentState: status }) => ({ id, status }));
};
