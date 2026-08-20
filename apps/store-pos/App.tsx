import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { fetchCatalog, generatedCatalog, type Product } from './src/catalog';
import {
  type CartLine,
  canCheckout,
  cartTotalCents,
  formatMoney,
  type Health,
  nextPaymentState,
  type PaymentEvent,
  type PaymentState,
  queueSaleIfOffline,
} from './src/domain';

const queryClient = new QueryClient();
const initialHealth: Health = { storeOnline: true, deviceOnline: true, paymentsAvailable: true };
const outcomes: Array<Exclude<PaymentEvent, 'start' | 'retry' | 'reset'>> = ['approve', 'decline', 'timeout'];
const queueStorageKey = 'retail-reliability-lab:offline-sales:v1';

function AppScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 850;
  const catalog = useQuery({ queryKey: ['generated-catalog'], queryFn: fetchCatalog, staleTime: Infinity });
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [health, setHealth] = useState<Health>(initialHealth);
  const [payment, setPayment] = useState<PaymentState>('idle');
  const [outcome, setOutcome] = useState<(typeof outcomes)[number]>('approve');
  const [scanIndex, setScanIndex] = useState(0);
  const [saleSequence, setSaleSequence] = useState(1);
  const [queuedSales, setQueuedSales] = useState<string[]>([]);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const [lastNotice, setLastNotice] = useState('Ready to scan.');

  const products = catalog.data ?? [];
  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(query.toLowerCase()) ||
          product.category.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );
  const guard = canCheckout(cart, health);
  const total = cartTotalCents(cart);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(queueStorageKey)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) setQueuedSales(parsed);
      })
      .catch(() => setLastNotice('Saved offline sales could not be loaded; retry after checking storage.'))
      .finally(() => {
        if (active) setQueueHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (queueHydrated)
      AsyncStorage.setItem(queueStorageKey, JSON.stringify(queuedSales)).catch(() => {
        setLastNotice('Offline queue could not be persisted on this device.');
      });
  }, [queueHydrated, queuedSales]);

  useEffect(() => {
    if (queueHydrated && health.storeOnline && queuedSales.length) {
      setLastNotice(
        `${queuedSales.length} completed sale${queuedSales.length === 1 ? '' : 's'} synced to cloud.`,
      );
      setQueuedSales([]);
    }
  }, [health.storeOnline, queueHydrated, queuedSales.length]);

  const add = (product: Product) => {
    setCart((lines) => {
      const existing = lines.find((line) => line.sku === product.sku);
      return existing
        ? lines.map((line) => (line.sku === product.sku ? { ...line, quantity: line.quantity + 1 } : line))
        : [...lines, { sku: product.sku, quantity: 1, priceCents: product.priceCents }];
    });
    setLastNotice(`${product.name} added to cart.`);
  };
  const updateQuantity = (sku: string, delta: number) =>
    setCart((lines) =>
      lines.flatMap((line) =>
        line.sku === sku
          ? line.quantity + delta <= 0
            ? []
            : [{ ...line, quantity: line.quantity + delta }]
          : [line],
      ),
    );
  const scan = () => {
    const product = generatedCatalog[scanIndex % generatedCatalog.length];
    setScanIndex((value) => value + 1);
    add(product);
    setLastNotice(`Barcode ${product.barcode} scanned: ${product.name}.`);
  };
  const transition = (event: PaymentEvent) => {
    const next = nextPaymentState(payment, event);
    setPayment(next);
    if (next === 'approved') {
      const saleId = `SALE-${String(saleSequence).padStart(4, '0')}`;
      setSaleSequence((value) => value + 1);
      const queued = queueSaleIfOffline({ id: saleId, status: 'approved' }, health.storeOnline);
      if (queued.length) setQueuedSales((sales) => (sales.includes(saleId) ? sales : [...sales, saleId]));
      setCart([]);
      setLastNotice(
        queued.length
          ? `Sale ${saleId} complete and safely queued for sync.`
          : `Sale ${saleId} approved and recorded.`,
      );
    } else if (next === 'declined')
      setLastNotice('Payment declined. Select retry after correcting the issue.');
    else if (next === 'timeout') setLastNotice('Payment timed out. No sale was completed; retry is safe.');
  };
  const checkout = () => {
    if (!guard.allowed) {
      setLastNotice(guard.reason);
      AccessibilityInfo.announceForAccessibility(guard.reason);
      return;
    }
    if (payment === 'approved') {
      setPayment('processing');
      setLastNotice('Payment processing…');
      return;
    }
    transition(payment === 'timeout' || payment === 'declined' ? 'retry' : 'start');
  };
  const stateCopy: Record<PaymentState, string> = {
    idle: 'Awaiting payment',
    processing: 'Processing payment…',
    approved: 'Approved',
    declined: 'Declined — retry available',
    timeout: 'Timed out — retry available',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View>
            <Text style={styles.eyebrow}>NORTHLINE MARKET / TERMINAL 04</Text>
            <Text style={styles.title}>
              Fast checkout,<Text style={styles.titleAccent}> made resilient.</Text>
            </Text>
          </View>
          <View style={styles.live}>
            <View style={[styles.dot, { backgroundColor: health.storeOnline ? '#21A179' : '#D95757' }]} />
            <Text style={styles.liveText}>{health.storeOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Independent demo — generated catalog and simulated payments only. No real transaction is created.
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {lastNotice}
        </Text>
        <View style={[styles.grid, compact && styles.gridCompact]}>
          <View style={[styles.catalogPanel, compact && styles.panelCompact]}>
            <Text style={styles.sectionTitle}>Add to basket</Text>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Search generated product catalog"
                value={query}
                onChangeText={setQuery}
                placeholder="Search coffee, snacks, drinks…"
                placeholderTextColor="#657080"
                style={styles.input}
              />
              <Action label="Simulate barcode scan" title="Scan barcode" onPress={scan} tone="dark" />
            </View>
            {catalog.isLoading ? (
              <Text style={styles.muted}>Loading generated catalog…</Text>
            ) : (
              <View style={styles.products}>
                {filtered.map((product) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${product.name}, ${formatMoney(product.priceCents)}`}
                    key={product.sku}
                    onPress={() => add(product)}
                    style={({ pressed }) => [styles.product, pressed && styles.pressed]}
                  >
                    <View style={[styles.productIcon, { backgroundColor: product.accent }]}>
                      <Text style={styles.iconText}>{product.name.slice(0, 1)}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.muted}>{product.category}</Text>
                    </View>
                    <Text style={styles.price}>{formatMoney(product.priceCents)}</Text>
                    <Text style={styles.plus}>＋</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <View style={[styles.checkoutPanel, compact && styles.panelCompact]}>
            <View style={styles.cartHeading}>
              <Text style={styles.sectionTitle}>Basket</Text>
              <Text style={styles.itemCount}>
                {cart.reduce((count, item) => count + item.quantity, 0)} items
              </Text>
            </View>
            {cart.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>◎</Text>
                <Text style={styles.emptyTitle}>Your basket is clear</Text>
                <Text style={styles.muted}>Scan an item or choose from the catalog.</Text>
              </View>
            ) : (
              cart.map((line) => {
                const product = products.find((item) => item.sku === line.sku);
                return (
                  <View key={line.sku} style={styles.line}>
                    <View style={styles.lineInfo}>
                      <Text style={styles.productName}>{product?.name}</Text>
                      <Text style={styles.muted}>{formatMoney(line.priceCents)} each</Text>
                    </View>
                    <View style={styles.quantity}>
                      <SmallButton
                        label={`Remove one ${product?.name}`}
                        text="−"
                        onPress={() => updateQuantity(line.sku, -1)}
                      />
                      <Text style={styles.quantityText}>{line.quantity}</Text>
                      <SmallButton
                        label={`Add one ${product?.name}`}
                        text="+"
                        onPress={() => updateQuantity(line.sku, 1)}
                      />
                    </View>
                    <Text style={styles.linePrice}>{formatMoney(line.quantity * line.priceCents)}</Text>
                  </View>
                );
              })
            )}
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            </View>
            <View
              style={[
                styles.paymentState,
                payment === 'approved' && styles.approved,
                (payment === 'declined' || payment === 'timeout') && styles.failed,
              ]}
            >
              <Text style={styles.paymentLabel}>PAYMENT STATUS</Text>
              <Text style={styles.paymentText}>{stateCopy[payment]}</Text>
            </View>
            <Text style={styles.controlLabel}>Deterministic payment outcome</Text>
            <View style={styles.outcomes}>
              {outcomes.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: outcome === item }}
                  accessibilityLabel={`Outcome: ${item}`}
                  onPress={() => setOutcome(item)}
                  style={[styles.outcome, outcome === item && styles.outcomeSelected]}
                >
                  <Text style={[styles.outcomeText, outcome === item && styles.outcomeTextSelected]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Action
              label={guard.allowed ? `Pay ${formatMoney(total)}` : `Checkout unavailable: ${guard.reason}`}
              title={
                payment === 'processing'
                  ? 'Processing…'
                  : payment === 'timeout' || payment === 'declined'
                    ? 'Retry payment'
                    : `Pay ${formatMoney(total)}`
              }
              onPress={() => (payment === 'processing' ? undefined : checkout())}
              disabled={payment === 'processing' || (!guard.allowed && payment === 'idle')}
              tone="primary"
            />
            {payment === 'processing' && (
              <Action
                label={`Finish payment as ${outcome}`}
                title={`Simulate ${outcome}`}
                onPress={() => transition(outcome)}
                tone="dark"
              />
            )}
          </View>
        </View>
        <View style={[styles.health, compact && styles.healthCompact]}>
          <View>
            <Text style={styles.sectionTitle}>Store & device health</Text>
            <Text style={styles.muted}>
              Checkout is guarded until every operational prerequisite is safe.
            </Text>
          </View>
          <View style={[styles.toggles, compact && styles.togglesCompact]}>
            <Toggle
              label="Store connection"
              value={health.storeOnline}
              onPress={() => setHealth((value) => ({ ...value, storeOnline: !value.storeOnline }))}
            />
            <Toggle
              label="Scanner device"
              value={health.deviceOnline}
              onPress={() => setHealth((value) => ({ ...value, deviceOnline: !value.deviceOnline }))}
            />
            <Toggle
              label="Payment terminal"
              value={health.paymentsAvailable}
              onPress={() =>
                setHealth((value) => ({ ...value, paymentsAvailable: !value.paymentsAvailable }))
              }
            />
          </View>
        </View>
        <View style={styles.sync}>
          <Text style={styles.syncTitle}>Offline recovery</Text>
          <Text style={styles.syncText}>
            {queuedSales.length
              ? `${queuedSales.length} approved sale waiting securely for connection recovery.`
              : 'No completed sales waiting to sync.'}
          </Text>
          <Text style={styles.muted}>Turn Store connection on to trigger deterministic sync recovery.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  title,
  onPress,
  tone,
  disabled,
  label,
}: {
  title: string;
  onPress: () => void;
  tone: 'primary' | 'dark';
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'dark' ? styles.darkAction : styles.primaryAction,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}
function SmallButton({ text, onPress, label }: { text: string; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.smallButton}
    >
      <Text style={styles.smallButtonText}>{text}</Text>
    </Pressable>
  );
}
function Toggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${label}: ${value ? 'safe' : 'unsafe'}`}
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={styles.toggle}
    >
      <View style={[styles.toggleDot, { backgroundColor: value ? '#21A179' : '#D95757' }]} />
      <Text style={styles.toggleText}>{label}</Text>
      <Text style={[styles.toggleStatus, { color: value ? '#167557' : '#AF3B3B' }]}>
        {value ? 'SAFE' : 'UNSAFE'}
      </Text>
    </Pressable>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppScreen />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F0' },
  page: { maxWidth: 1280, width: '100%', alignSelf: 'center', padding: 24, gap: 16 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#607080' },
  title: {
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.5,
    color: '#14212D',
    fontWeight: '800',
    maxWidth: 570,
  },
  titleAccent: { color: '#167557' },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#E5F4ED',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 8 },
  liveText: { fontSize: 12, fontWeight: '900', color: '#167557', letterSpacing: 0.8 },
  disclaimer: { backgroundColor: '#E7EDF6', borderRadius: 10, padding: 12 },
  disclaimerText: { color: '#31445B', fontSize: 13, fontWeight: '600' },
  notice: { color: '#31445B', fontSize: 14, minHeight: 20 },
  grid: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  catalogPanel: {
    flex: 1.08,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    gap: 16,
    minWidth: 360,
  },
  checkoutPanel: {
    flex: 0.92,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    gap: 14,
    minWidth: 360,
  },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#14212D' },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D7DFE6',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#14212D',
    fontSize: 15,
    backgroundColor: '#FAFBFC',
  },
  action: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: { backgroundColor: '#167557' },
  darkAction: { backgroundColor: '#14212D' },
  disabled: { backgroundColor: '#AAB5B2' },
  actionText: { color: 'white', fontWeight: '800', fontSize: 15 },
  products: { gap: 9 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    borderWidth: 1,
    borderColor: '#E3E8E8',
    borderRadius: 12,
    padding: 9,
    gap: 11,
  },
  pressed: { opacity: 0.78 },
  productIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 21, fontWeight: '800', color: '#23303C' },
  productInfo: { flex: 1 },
  productName: { color: '#14212D', fontSize: 15, fontWeight: '800' },
  muted: { color: '#657080', fontSize: 13, lineHeight: 19 },
  price: { fontSize: 15, fontWeight: '800', color: '#14212D' },
  plus: { fontSize: 22, color: '#167557', marginLeft: 2 },
  cartHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCount: { color: '#657080', fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 45, gap: 5 },
  emptyIcon: { fontSize: 32, color: '#9BA8B6' },
  emptyTitle: { color: '#14212D', fontWeight: '800', fontSize: 16 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F2',
    paddingVertical: 9,
  },
  lineInfo: { flex: 1 },
  quantity: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  smallButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8D2D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { color: '#14212D', fontSize: 19, fontWeight: '700' },
  quantityText: { width: 20, textAlign: 'center', fontWeight: '800', color: '#14212D' },
  linePrice: { minWidth: 55, textAlign: 'right', color: '#14212D', fontWeight: '800' },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 7 },
  totalLabel: { fontSize: 18, color: '#14212D', fontWeight: '800' },
  totalValue: { fontSize: 25, color: '#14212D', fontWeight: '900' },
  paymentState: { backgroundColor: '#EFF3F5', padding: 12, borderRadius: 10 },
  approved: { backgroundColor: '#E4F5EC' },
  failed: { backgroundColor: '#FBE9E8' },
  paymentLabel: { color: '#607080', fontSize: 11, letterSpacing: 0.8, fontWeight: '900' },
  paymentText: { color: '#14212D', fontSize: 15, fontWeight: '800', marginTop: 2 },
  controlLabel: { color: '#607080', fontSize: 12, fontWeight: '800' },
  outcomes: { flexDirection: 'row', gap: 8 },
  outcome: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F0F3F4',
  },
  outcomeSelected: { backgroundColor: '#D7EDE3', borderWidth: 1, borderColor: '#167557' },
  outcomeText: { color: '#52616F', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  outcomeTextSelected: { color: '#126347' },
  health: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
  },
  toggles: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 46,
    paddingHorizontal: 12,
    backgroundColor: '#F5F7F7',
    borderRadius: 9,
  },
  toggleDot: { width: 10, height: 10, borderRadius: 5 },
  toggleText: { color: '#31404D', fontWeight: '700' },
  toggleStatus: { fontWeight: '900', fontSize: 11 },
  sync: { borderRadius: 15, padding: 18, backgroundColor: '#14212D', gap: 3 },
  syncTitle: { color: 'white', fontSize: 16, fontWeight: '800' },
  syncText: { color: '#D9E4EA', fontSize: 14 },
  heroCompact: { flexDirection: 'column', gap: 12 },
  gridCompact: { flexDirection: 'column' },
  panelCompact: { width: '100%', minWidth: 0 },
  healthCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  togglesCompact: { justifyContent: 'flex-start' },
});
