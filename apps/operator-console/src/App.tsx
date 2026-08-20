import { Pause, PlayArrow, Refresh, Search, WifiOff } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { assessInventoryRisk } from '@retail-reliability/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { api, type Incident, type InventoryItem, type Store, type Transaction } from './api';

const risk = (item: InventoryItem) =>
  assessInventoryRisk({
    productId: item.sku,
    onHand: item.onHand,
    target: item.par,
    critical: Math.ceil(item.par * 0.25),
  }).level === 'critical';
const statusClass = (status: Store['status']) => status.toLowerCase();
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function StatePanel({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <Paper sx={{ p: 3, textAlign: 'center' }} role="status">
      {error ? (
        <>
          <WifiOff color="error" />
          <Typography sx={{ mt: 1 }}>{error}</Typography>
          <Button sx={{ mt: 1 }} onClick={retry} startIcon={<Refresh />}>
            Retry data load
          </Button>
        </>
      ) : (
        <>
          <CircularProgress size={25} />
          <Typography sx={{ mt: 1 }}>Loading operational snapshot…</Typography>
        </>
      )}
    </Paper>
  );
}

function App() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'deterministic' | 'live'>('deterministic');
  const [paused, setPaused] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);
  const [filter, setFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(true);
  const [notice, setNotice] = useState('');
  const snapshot = useQuery({ queryKey: ['dashboard', mode], queryFn: api.dashboard, staleTime: 5_000 });
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    if (snapshot.data) {
      setIncidents(snapshot.data.incidents);
      setTransactions(snapshot.data.transactions);
    }
  }, [snapshot.data]);
  useEffect(() => {
    if (paused || mode !== 'live') return;
    const timer = window.setInterval(
      () => setTransactions((old) => [api.nextTransaction(old.length + 1), ...old].slice(0, 8)),
      3500,
    );
    return () => window.clearInterval(timer);
  }, [paused, mode]);
  const assign = useMutation({
    mutationFn: ({ incident, assignee }: { incident: Incident; assignee: string }) =>
      api.assign(incident, assignee),
    onMutate: ({ incident, assignee }) => {
      const previous = incidents;
      setIncidents((all) => all.map((row) => (row.id === incident.id ? { ...row, assignee } : row)));
      setNotice('');
      return { previous };
    },
    onError: (_error, _vars, context) => {
      setIncidents(context?.previous ?? []);
      setNotice(
        'Assignment could not be saved; the simulated server rejected it and your queue was restored.',
      );
    },
    onSuccess: () => setNotice('Assignment saved to the simulated operations queue.'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const inventory = snapshot.data?.inventory ?? [];
  const filtered = useMemo(
    () =>
      inventory.filter(
        (item) =>
          (!lowOnly || risk(item)) &&
          `${item.product} ${item.store}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    [inventory, lowOnly, filter],
  );
  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      { accessorKey: 'product', header: 'Product' },
      { accessorKey: 'store', header: 'Store' },
      {
        accessorKey: 'onHand',
        header: 'On hand',
        cell: ({ row }) => (
          <Chip
            size="small"
            color={risk(row.original) ? 'error' : 'success'}
            label={`${row.original.onHand} / ${row.original.par}`}
          />
        ),
      },
      { accessorKey: 'velocity', header: 'Daily velocity' },
      {
        id: 'triage',
        header: 'Triage',
        cell: ({ row }) =>
          risk(row.original) ? (
            <Chip size="small" color="warning" label="Replenish" />
          ) : (
            <Typography variant="body2">Covered</Typography>
          ),
      },
    ],
    [],
  );
  const [sorting, setSorting] = useState<SortingState>([{ id: 'onHand', desc: false }]);
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const setDemoMode = (live: boolean) => {
    const next = live ? 'live' : 'deterministic';
    api.setMode(next);
    setMode(next);
    setPaused(false);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <Box>
          <Typography className="eyebrow">Northstar retail · operations</Typography>
          <Typography variant="h4" component="h1">
            Operator Console
          </Typography>
          <Typography className="muted">
            A trustworthy working view of unattended retail locations.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={mode === 'live' ? 'LIVE SIMULATION' : 'DETERMINISTIC'}
            color={mode === 'live' ? 'success' : 'default'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'live'}
                onChange={(e) => setDemoMode(e.target.checked)}
                inputProps={{ 'aria-label': 'Enable live simulation' }}
              />
            }
            label="Live mode"
          />
        </Stack>
      </header>
      {snapshot.isLoading ? (
        <StatePanel />
      ) : snapshot.isError ? (
        <StatePanel error={snapshot.error.message} retry={() => snapshot.refetch()} />
      ) : (
        <>
          <section aria-labelledby="fleet-heading" className="grid">
            <div className="span-12 panel-title">
              <Typography id="fleet-heading" variant="h5" component="h2">
                Fleet health
              </Typography>
              <Typography className="freshness">
                Snapshot {snapshot.isStale ? 'stale — refreshing' : 'fresh'} · updated moments ago
              </Typography>
            </div>
            {snapshot.data?.stores.map((store) => (
              <Card className="span-4 metric" key={store.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={750}>
                        {store.name}
                      </Typography>
                      <Typography variant="body2" className="muted">
                        {store.city}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={store.status}
                      color={
                        store.status === 'Healthy'
                          ? 'success'
                          : store.status === 'Attention'
                            ? 'warning'
                            : 'error'
                      }
                    />
                  </Stack>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption">
                      <span className={`status-dot ${statusClass(store.status)}`} />
                      {store.devices} devices
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setSelected(store)}
                      aria-label={`View ${store.name} details`}
                    >
                      Details
                    </Button>
                  </Stack>
                  <Typography className="freshness" sx={{ mt: 1 }}>
                    {store.updatedMinutes > 10
                      ? `STALE: ${store.updatedMinutes} min since device signal`
                      : `Signal ${store.updatedMinutes} min ago`}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </section>
          <section className="grid" style={{ marginTop: 16 }}>
            <Paper className="span-7" sx={{ p: 2 }} component="section" aria-labelledby="inventory-heading">
              <div className="panel-title">
                <Typography id="inventory-heading" variant="h6" component="h2">
                  Inventory triage
                </Typography>
                <Chip label={`${filtered.length} items`} size="small" />
              </div>
              <div className="toolbar">
                <TextField
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  size="small"
                  label="Search inventory"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControlLabel
                  control={<Switch checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />}
                  label="Low stock only"
                />
              </div>
              <div className="scroll">
                <Table size="small" aria-label="Inventory triage table">
                  <TableHead>
                    {table.getHeaderGroups().map((group) => (
                      <TableRow key={group.id}>
                        {group.headers.map((header) => (
                          <TableCell key={header.id}>
                            {header.isPlaceholder ? null : (
                              <Button size="small" onClick={header.column.getToggleSortingHandler()}>
                                {String(header.column.columnDef.header)}
                                {header.column.getIsSorted() === 'asc'
                                  ? ' ↑'
                                  : header.column.getIsSorted() === 'desc'
                                    ? ' ↓'
                                    : ''}
                              </Button>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableHead>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!table.getRowModel().rows.length && (
                      <TableRow>
                        <TableCell colSpan={5}>No inventory matches this triage view.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Paper>
            <Paper className="span-5" sx={{ p: 2 }} component="section" aria-labelledby="incident-heading">
              <div className="panel-title">
                <Typography id="incident-heading" variant="h6" component="h2">
                  Incident queue
                </Typography>
                <Chip
                  color="error"
                  label={`${incidents.filter((i) => !i.assignee).length} unassigned`}
                  size="small"
                />
              </div>
              {notice && (
                <Alert severity={notice.startsWith('Assignment could') ? 'error' : 'success'} sx={{ mb: 1 }}>
                  {notice}
                </Alert>
              )}
              {incidents.length ? (
                incidents.map((incident) => (
                  <Box key={incident.id} sx={{ py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Box>
                        <Typography fontWeight={700}>{incident.title}</Typography>
                        <Typography variant="caption" className="muted">
                          {incident.store} · {incident.severity}{' '}
                          {incident.assignee ? `· ${incident.assignee}` : ''}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={assign.isPending || Boolean(incident.assignee)}
                        onClick={() => assign.mutate({ incident, assignee: 'Alex Rivera' })}
                        aria-label={`Assign ${incident.title}`}
                      >
                        {incident.assignee ?? 'Assign'}
                      </Button>
                    </Stack>
                  </Box>
                ))
              ) : (
                <Typography className="muted">No active incidents. Nice work.</Typography>
              )}
            </Paper>
          </section>
          <section className="grid" style={{ marginTop: 16 }}>
            <Paper className="span-8" sx={{ p: 2 }} component="section" aria-labelledby="feed-heading">
              <div className="panel-title">
                <Box>
                  <Typography id="feed-heading" variant="h6" component="h2">
                    Live transaction feed
                  </Typography>
                  <Typography className="freshness">
                    {paused
                      ? 'Paused — events may be stale'
                      : mode === 'live'
                        ? 'Streaming deterministic live events'
                        : 'Snapshot feed — enable Live mode to stream'}
                  </Typography>
                </Box>
                <Tooltip title={paused ? 'Resume live feed' : 'Pause live feed'}>
                  <IconButton
                    color="primary"
                    onClick={() => setPaused(!paused)}
                    aria-label={paused ? 'Resume live feed' : 'Pause live feed'}
                  >
                    {paused ? <PlayArrow /> : <Pause />}
                  </IconButton>
                </Tooltip>
              </div>
              {transactions.map((tx) => (
                <div className="activity" key={tx.id}>
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={700}>
                        {money.format(tx.amount)} · {tx.status}
                      </Typography>
                      <Typography variant="caption" className="muted">
                        {tx.store} · {tx.method}
                      </Typography>
                    </Box>
                    <Typography variant="caption" className="muted">
                      {tx.timestamp}
                    </Typography>
                  </Stack>
                </div>
              ))}
            </Paper>
            <Paper className="span-4" sx={{ p: 2 }} component="aside" aria-labelledby="trust-heading">
              <Typography id="trust-heading" variant="h6" component="h2">
                Trust signals
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <Typography variant="body2">
                  <b>Offline aware:</b> requests surface a retryable offline state.
                </Typography>
                <Typography variant="body2">
                  <b>Stale visible:</b> delayed device signals never read as current.
                </Typography>
                <Typography variant="body2">
                  <b>Keyboard first:</b> native controls, focus rings, labeled actions.
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={78}
                  color="success"
                  aria-label="Fleet service level 78 percent"
                />
              </Stack>
            </Paper>
          </section>
        </>
      )}
      <footer className="disclaimer">
        Independent portfolio demo. All store names, transactions, incidents, and inventory are generated
        simulation data; no production systems or customer data are connected.
      </footer>
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        aria-labelledby="store-dialog-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="store-dialog-title">{selected?.name} · store details</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Alert
                severity={
                  selected.status === 'Healthy'
                    ? 'success'
                    : selected.status === 'Attention'
                      ? 'warning'
                      : 'error'
                }
              >
                {selected.status} · last device signal {selected.updatedMinutes} minutes ago
              </Alert>
              <Typography>
                <b>Device health:</b> {selected.devices - (selected.status === 'Healthy' ? 0 : 1)} of{' '}
                {selected.devices} responsive
              </Typography>
              <Typography>
                <b>Inventory risk:</b> {selected.risk}% of mapped products need attention
              </Typography>
              <Typography>
                <b>Recent activity:</b> Door check completed; replenishment signal queued.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} autoFocus>
            Close details
          </Button>
        </DialogActions>
      </Dialog>
    </main>
  );
}
export default App;
