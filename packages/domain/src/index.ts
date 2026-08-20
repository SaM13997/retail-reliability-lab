import { z } from 'zod';

/** ISO 4217 currency represented as upper-case three-letter code. */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'currency must be a three-letter upper-case ISO code');
export const moneySchema = z
  .object({
    currency: currencySchema,
    minor: z.number().int().safe(),
  })
  .strict();
export type Money = z.infer<typeof moneySchema>;

export const parseMoney = (value: unknown): Money => moneySchema.parse(value);
export const zeroMoney = (currency: string): Money => ({
  currency: currencySchema.parse(currency),
  minor: 0,
});

const ensureSameCurrency = (left: Money, right: Money): void => {
  if (left.currency !== right.currency)
    throw new Error(`currency mismatch: ${left.currency} and ${right.currency}`);
};

export const addMoney = (left: Money, right: Money): Money => {
  ensureSameCurrency(left, right);
  return parseMoney({ currency: left.currency, minor: left.minor + right.minor });
};

export const multiplyMoney = (amount: Money, quantity: number): Money => {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error('quantity must be a non-negative safe integer');
  return parseMoney({ currency: amount.currency, minor: amount.minor * quantity });
};

export const productSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    price: moneySchema.refine((value) => value.minor >= 0, 'price cannot be negative'),
    active: z.boolean(),
    barcode: z.string().min(1).optional(),
  })
  .strict();
export type Product = z.infer<typeof productSchema>;

export const inventoryRecordSchema = z
  .object({
    productId: z.string().min(1),
    onHand: z.number().int().nonnegative(),
    target: z.number().int().positive(),
    critical: z.number().int().nonnegative(),
  })
  .strict()
  .refine((value) => value.critical <= value.target, 'critical must not exceed target');
export type InventoryRecord = z.infer<typeof inventoryRecordSchema>;
export type InventoryRiskLevel = 'critical' | 'low' | 'healthy';
export interface InventoryRisk {
  level: InventoryRiskLevel;
  fillPercent: number;
  suggestedFill: number;
}
export const assessInventoryRisk = (value: InventoryRecord): InventoryRisk => {
  const inventory = inventoryRecordSchema.parse(value);
  const level: InventoryRiskLevel =
    inventory.onHand <= inventory.critical
      ? 'critical'
      : inventory.onHand < inventory.target
        ? 'low'
        : 'healthy';
  return {
    level,
    fillPercent: Math.round((inventory.onHand / inventory.target) * 100),
    suggestedFill: Math.max(0, inventory.target - inventory.onHand),
  };
};

export const deviceKindSchema = z.enum(['payment-reader', 'scanner', 'network', 'door-sensor', 'scale']);
export const deviceStatusSchema = z.enum(['online', 'degraded', 'offline']);
export const deviceHealthSchema = z
  .object({
    id: z.string().min(1),
    kind: deviceKindSchema,
    requiredForCheckout: z.boolean(),
    status: deviceStatusSchema,
    lastSeenAt: z.string().datetime(),
  })
  .strict();
export type DeviceHealth = z.infer<typeof deviceHealthSchema>;

export const storeHealthInputSchema = z
  .object({
    now: z.string().datetime(),
    staleAfterMinutes: z.number().positive(),
    devices: z.array(deviceHealthSchema),
  })
  .strict();
export type StoreHealthInput = z.infer<typeof storeHealthInputSchema>;
export type StoreHealthStatus = 'healthy' | 'degraded' | 'unsafe' | 'stale';
export interface StoreHealthSummary {
  status: StoreHealthStatus;
  stale: boolean;
  offlineRequiredDeviceIds: string[];
  degradedDeviceIds: string[];
}
export const summarizeStoreHealth = (value: StoreHealthInput): StoreHealthSummary => {
  const input = storeHealthInputSchema.parse(value);
  const now = Date.parse(input.now);
  const staleAt = now - input.staleAfterMinutes * 60_000;
  const stale =
    input.devices.length === 0 || input.devices.some((device) => Date.parse(device.lastSeenAt) < staleAt);
  const offlineRequiredDeviceIds = input.devices
    .filter((device) => device.requiredForCheckout && device.status === 'offline')
    .map((device) => device.id);
  const degradedDeviceIds = input.devices
    .filter((device) => device.status === 'degraded')
    .map((device) => device.id);
  const status: StoreHealthStatus =
    offlineRequiredDeviceIds.length > 0
      ? 'unsafe'
      : stale
        ? 'stale'
        : degradedDeviceIds.length > 0
          ? 'degraded'
          : 'healthy';
  return { status, stale, offlineRequiredDeviceIds, degradedDeviceIds };
};

export type CheckoutBlockReason = 'cart-empty' | 'store-data-stale' | 'required-device-offline';
export type CheckoutGuard = { allowed: true } | { allowed: false; reason: CheckoutBlockReason };
export const canCheckout = ({
  store,
  cartLines,
}: {
  store: StoreHealthSummary;
  cartLines: number;
}): CheckoutGuard => {
  if (!Number.isSafeInteger(cartLines) || cartLines < 0)
    throw new Error('cartLines must be a non-negative safe integer');
  if (cartLines === 0) return { allowed: false, reason: 'cart-empty' };
  if (store.offlineRequiredDeviceIds.length > 0) return { allowed: false, reason: 'required-device-offline' };
  if (store.stale) return { allowed: false, reason: 'store-data-stale' };
  return { allowed: true };
};

export const cartLineSchema = z
  .object({
    productId: z.string().min(1),
    unitPrice: moneySchema.refine((value) => value.minor >= 0),
    quantity: z.number().int().positive(),
    discountMinor: z.number().int().nonnegative(),
  })
  .strict();
export type CartLine = z.infer<typeof cartLineSchema>;
export const cartInputSchema = z
  .object({
    currency: currencySchema,
    taxBasisPoints: z.number().int().nonnegative(),
    lines: z.array(cartLineSchema),
  })
  .strict();
export type CartInput = z.infer<typeof cartInputSchema>;
export interface CartTotals {
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
}
export const calculateCartTotals = (value: CartInput): CartTotals => {
  const input = cartInputSchema.parse(value);
  let subtotalMinor = 0;
  let discountMinor = 0;
  for (const line of input.lines) {
    if (line.unitPrice.currency !== input.currency) throw new Error('cart line currency mismatch');
    const lineSubtotal = line.unitPrice.minor * line.quantity;
    if (line.discountMinor > lineSubtotal) throw new Error('discount cannot exceed line subtotal');
    subtotalMinor += lineSubtotal;
    discountMinor += line.discountMinor;
  }
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = Math.round((taxableMinor * input.taxBasisPoints) / 10_000);
  return {
    subtotal: parseMoney({ currency: input.currency, minor: subtotalMinor }),
    discount: parseMoney({ currency: input.currency, minor: discountMinor }),
    tax: parseMoney({ currency: input.currency, minor: taxMinor }),
    total: parseMoney({ currency: input.currency, minor: taxableMinor + taxMinor }),
  };
};

export const paymentStateSchema = z.enum(['idle', 'processing', 'approved', 'declined', 'timed-out']);
export type PaymentState = z.infer<typeof paymentStateSchema>;
export const paymentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started') }).strict(),
  z.object({ type: z.literal('approved'), authorizationId: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal('declined'), reason: z.string().min(1) }).strict(),
  z.object({ type: z.literal('timed-out') }).strict(),
  z.object({ type: z.literal('retry') }).strict(),
  z.object({ type: z.literal('reset') }).strict(),
]);
export type PaymentEvent = z.infer<typeof paymentEventSchema>;
const transitions: Record<PaymentState, Partial<Record<PaymentEvent['type'], PaymentState>>> = {
  idle: { started: 'processing' },
  processing: { approved: 'approved', declined: 'declined', 'timed-out': 'timed-out' },
  approved: { reset: 'idle' },
  declined: { retry: 'processing', reset: 'idle' },
  'timed-out': { retry: 'processing', reset: 'idle' },
};
export const nextPaymentState = (state: PaymentState, event: PaymentEvent): PaymentState => {
  paymentStateSchema.parse(state);
  const validatedEvent = paymentEventSchema.parse(event);
  const next = transitions[state][validatedEvent.type];
  if (!next) throw new Error(`invalid payment transition: ${state} -> ${validatedEvent.type}`);
  return next;
};

export const offlineSaleSchema = z
  .object({
    id: z.string().min(1),
    completedAt: z.string().datetime(),
    total: moneySchema.refine((value) => value.minor >= 0),
    paymentState: z.literal('approved'),
  })
  .strict();
export type OfflineSale = z.infer<typeof offlineSaleSchema>;
export type OfflineSaleQueue = readonly OfflineSale[];
export const enqueueOfflineSale = (queue: OfflineSaleQueue, sale: OfflineSale): OfflineSaleQueue => {
  const parsedSale = offlineSaleSchema.parse(sale);
  if (queue.some((item) => item.id === parsedSale.id)) return queue;
  return [...queue, parsedSale];
};

/** Stable pseudo-random fixtures for demo and test use; no system time or random global state. */
const hashSeed = (seed: string): number =>
  [...seed].reduce((state, char) => Math.imul(state ^ char.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261);
const rng = (seed: string): (() => number) => {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};
export interface DomainFixtures {
  products: Product[];
  inventory: InventoryRecord[];
}
export const createSeededFixtures = (seed: string): DomainFixtures => {
  const random = rng(seed);
  const products: Product[] = ['Sparkling Water', 'Trail Mix', 'Cold Brew'].map((name, index) => ({
    id: `sku-${index + 1}`,
    name,
    price: { currency: 'USD', minor: 150 + index * 125 },
    active: true,
  }));
  const inventory = products.map((product) => ({
    productId: product.id,
    onHand: Math.floor(random() * 16),
    target: 12,
    critical: 3,
  }));
  return { products, inventory };
};
