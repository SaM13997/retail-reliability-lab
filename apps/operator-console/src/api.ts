export type StoreStatus = 'Healthy' | 'Attention' | 'Offline';
export type Store = {
  id: string;
  name: string;
  city: string;
  status: StoreStatus;
  updatedMinutes: number;
  devices: number;
  risk: number;
};
export type InventoryItem = {
  sku: string;
  product: string;
  store: string;
  onHand: number;
  par: number;
  velocity: number;
};
export type Incident = {
  id: string;
  title: string;
  store: string;
  severity: 'P1' | 'P2' | 'P3';
  assignee?: string;
  willFail?: boolean;
};
export type Transaction = {
  id: string;
  store: string;
  amount: number;
  method: string;
  timestamp: string;
  status: 'Approved' | 'Declined';
};

export const seed = {
  stores: [
    {
      id: 's-018',
      name: 'Pier 18 Market',
      city: 'Seattle, WA',
      status: 'Healthy',
      updatedMinutes: 1,
      devices: 4,
      risk: 8,
    },
    {
      id: 's-042',
      name: 'Central Station',
      city: 'Portland, OR',
      status: 'Attention',
      updatedMinutes: 3,
      devices: 4,
      risk: 37,
    },
    {
      id: 's-071',
      name: 'Cedar Commons',
      city: 'Spokane, WA',
      status: 'Offline',
      updatedMinutes: 19,
      devices: 3,
      risk: 64,
    },
    {
      id: 's-104',
      name: 'Ballard Works',
      city: 'Seattle, WA',
      status: 'Healthy',
      updatedMinutes: 2,
      devices: 5,
      risk: 12,
    },
  ] as Store[],
  inventory: [
    {
      sku: 'DRK-101',
      product: 'Sparkling Water · Lime',
      store: 'Central Station',
      onHand: 2,
      par: 12,
      velocity: 9,
    },
    { sku: 'SNK-220', product: 'Sea Salt Crisps', store: 'Cedar Commons', onHand: 0, par: 10, velocity: 6 },
    {
      sku: 'DRK-015',
      product: 'Cold Brew · Black',
      store: 'Pier 18 Market',
      onHand: 7,
      par: 14,
      velocity: 11,
    },
    {
      sku: 'SNK-414',
      product: 'Almond Protein Bar',
      store: 'Ballard Works',
      onHand: 18,
      par: 12,
      velocity: 4,
    },
    { sku: 'MEAL-111', product: 'Sesame Noodles', store: 'Central Station', onHand: 1, par: 8, velocity: 5 },
  ] as InventoryItem[],
  incidents: [
    {
      id: 'i-1',
      title: 'Payment terminal degraded',
      store: 'Central Station',
      severity: 'P1',
      willFail: true,
    },
    { id: 'i-2', title: 'Door sensor intermittent', store: 'Cedar Commons', severity: 'P2' },
    { id: 'i-3', title: 'Temperature threshold warning', store: 'Pier 18 Market', severity: 'P3' },
  ] as Incident[],
  transactions: [
    {
      id: 'tx-8821',
      store: 'Pier 18 Market',
      amount: 4.75,
      method: 'Visa •••• 4242',
      timestamp: 'Just now',
      status: 'Approved',
    },
    {
      id: 'tx-8820',
      store: 'Central Station',
      amount: 8.5,
      method: 'Wallet',
      timestamp: '1 min ago',
      status: 'Approved',
    },
    {
      id: 'tx-8819',
      store: 'Cedar Commons',
      amount: 3.25,
      method: 'Visa •••• 1008',
      timestamp: '2 min ago',
      status: 'Declined',
    },
  ] as Transaction[],
};

let mode: 'deterministic' | 'live' = 'deterministic';
const delay = (ms = 220) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const api = {
  setMode(next: typeof mode) {
    mode = next;
  },
  async dashboard() {
    await delay();
    if (!navigator.onLine) throw new Error('You are offline.');
    return structuredClone(seed);
  },
  async assign(incident: Incident, assignee: string) {
    await delay(300);
    if (mode === 'deterministic' && incident.willFail)
      throw new Error('Deterministic simulation rejected this assignment.');
    return { ...incident, assignee };
  },
  nextTransaction(index: number): Transaction {
    return {
      id: `tx-live-${index}`,
      store: index % 2 ? 'Ballard Works' : 'Pier 18 Market',
      amount: 2.5 + index,
      method: 'Wallet',
      timestamp: 'Live now',
      status: 'Approved',
    };
  },
};
