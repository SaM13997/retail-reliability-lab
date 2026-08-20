// Temporary app-local boundary. Replace this module's exports with @portfolio/domain when shared ownership lands.
export type CartLine = { sku: string; quantity: number; priceCents: number };
export type Health = { storeOnline: boolean; deviceOnline: boolean; paymentsAvailable: boolean };
export type PaymentState = 'idle' | 'processing' | 'approved' | 'declined' | 'timeout';
export type PaymentEvent = 'start' | 'approve' | 'decline' | 'timeout' | 'retry' | 'reset';
export type CompletedSale = { id: string; status: 'approved' | 'declined' };

export const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const cartTotalCents = (lines: CartLine[]) =>
  lines.reduce((total, line) => total + line.quantity * line.priceCents, 0);

export const canCheckout = (lines: CartLine[], health: Health) => {
  if (!lines.length) return { allowed: false, reason: 'Add an item before checking out.' } as const;
  if (!health.storeOnline) return { allowed: false, reason: 'Store connection is offline.' } as const;
  if (!health.deviceOnline) return { allowed: false, reason: 'Scanner device needs attention.' } as const;
  if (!health.paymentsAvailable) return { allowed: false, reason: 'Payments terminal is unavailable.' } as const;
  return { allowed: true, reason: '' } as const;
};

export const nextPaymentState = (state: PaymentState, event: PaymentEvent): PaymentState => {
  if (event === 'reset') return 'idle';
  if (event === 'start' && state === 'idle') return 'processing';
  if (event === 'approve' && state === 'processing') return 'approved';
  if (event === 'decline' && state === 'processing') return 'declined';
  if (event === 'timeout' && state === 'processing') return 'timeout';
  if (event === 'retry' && (state === 'declined' || state === 'timeout')) return 'processing';
  return state;
};

export const queueSaleIfOffline = (sale: CompletedSale, online: boolean) =>
  !online && sale.status === 'approved' ? [sale] : [];
