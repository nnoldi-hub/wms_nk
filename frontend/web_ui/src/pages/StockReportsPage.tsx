import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, Alert, TextField, Button,
  Stack, MenuItem, Select, FormControl, InputLabel, Card, CardContent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import axios from 'axios';

const API = 'http://localhost:3011/api/v1';

function authClient() {
  const token = localStorage.getItem('accessToken');
  return axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function fmtNum(n: number | string | null | undefined, dec = 2) {
  if (n == null || n === '') return '-';
  return Number(n).toFixed(dec);
}

// ─── Tab: Stoc pe lot ─────────────────────────────────────────────────────────

function StocPeLotTab() {
  type Row = Record<string, unknown>;
  const [rows, setRows] = useState<Row[]>([]);
  const [activeOrders, setActiveOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { limit: 500 };
      if (skuFilter) params.sku = skuFilter;
      if (statusFilter) params.status = statusFilter;
      const [rb, ro] = await Promise.allSettled([
        authClient().get('/batches', { params }),
        authClient().get('/orders', { params: { limit: 500 } }),
      ]);
      if (rb.status === 'fulfilled') {
        setRows(Array.isArray(rb.value.data?.data) ? rb.value.data.data : Array.isArray(rb.value.data) ? rb.value.data : []);
      } else {
        setError((rb.reason as Error)?.message || 'Eroare la loturi');
      }
      if (ro.status === 'fulfilled') {
        const oData: Row[] = Array.isArray(ro.value.data?.data) ? ro.value.data.data : Array.isArray(ro.value.data) ? ro.value.data : [];
        setActiveOrders(oData.filter(o => ['PICKING', 'READY_FOR_LOADING', 'LOADED'].includes(String(o.status))));
      }
      // orders failing silently is OK — picking/expediere columns will show 0
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [skuFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Count SKUs that appear in picking/expediere orders
  const skuInPicking = new Set<string>();
  const skuInExpediere = new Set<string>();
  for (const o of activeOrders) {
    const lines = o.lines as Row[] | undefined;
    if (!Array.isArray(lines)) continue;
    for (const l of lines) {
      const sku = String(l.product_sku || '');
      if (o.status === 'PICKING') skuInPicking.add(sku);
      if (o.status === 'READY_FOR_LOADING' || o.status === 'LOADED') skuInExpediere.add(sku);
    }
  }

  // Aggregate by SKU
  const bySku: Record<string, {
    sku: string; name: string; totalInitial: number; totalCurrent: number;
    reserved: number; lots: number; inPicking: boolean; inExpediere: boolean;
  }> = {};
  for (const r of rows) {
    const sku = String(r.product_sku || '-');
    if (!bySku[sku]) bySku[sku] = {
      sku, name: String(r.product_name || sku), totalInitial: 0, totalCurrent: 0,
      reserved: 0, lots: 0, inPicking: false, inExpediere: false,
    };
    bySku[sku].totalInitial += Number(r.initial_quantity || 0);
    bySku[sku].totalCurrent += Number(r.current_quantity || 0);
    bySku[sku].reserved += Number(r.reserved_quantity || 0);
    bySku[sku].lots++;
    if (skuInPicking.has(sku)) bySku[sku].inPicking = true;
    if (skuInExpediere.has(sku)) bySku[sku].inExpediere = true;
  }
  const summaryRows = Object.values(bySku).sort((a, b) => b.totalCurrent - a.totalCurrent);
  const totalInitial = summaryRows.reduce((s, r) => s + r.totalInitial, 0);
  const totalCurrent = summaryRows.reduce((s, r) => s + r.totalCurrent, 0);
  const totalReserved = summaryRows.reduce((s, r) => s + r.reserved, 0);

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    INTACT: 'success', CUT: 'warning', REPACKED: 'info', EMPTY: 'default', DAMAGED: 'error', QUARANTINE: 'error',
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <TextField label="SKU produs" size="small" value={skuFilter} onChange={e => setSkuFilter(e.target.value)} sx={{ width: 200 }} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status lot</InputLabel>
          <Select value={statusFilter} label="Status lot" onChange={e => setStatusFilter(e.target.value as string)}>
            <MenuItem value="">Toate</MenuItem>
            {['INTACT', 'CUT', 'REPACKED', 'EMPTY', 'DAMAGED', 'QUARANTINE'].map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary cards - stock state breakdown */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Total loturi</Typography>
          <Typography variant="h5">{rows.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">SKU-uri distincte</Typography>
          <Typography variant="h5">{summaryRows.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}><CardContent>
          <Typography variant="caption" color="success.main" fontWeight={700}>Disponibil</Typography>
          <Typography variant="h5" color="success.main">{fmtNum(totalCurrent - totalReserved, 0)}</Typography>
          <Typography variant="caption" color="text.secondary">qty nerezervată</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}><CardContent>
          <Typography variant="caption" color="warning.main" fontWeight={700}>Rezervat</Typography>
          <Typography variant="h5" color="warning.main">{fmtNum(totalReserved, 0)}</Typography>
          <Typography variant="caption" color="text.secondary">qty rezervată pt. comenzi</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}><CardContent>
          <Typography variant="caption" color="info.main" fontWeight={700}>În picking</Typography>
          <Typography variant="h5" color="info.main">{summaryRows.filter(r => r.inPicking).length} SKU</Typography>
          <Typography variant="caption" color="text.secondary">produse în picking activ</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}><CardContent>
          <Typography variant="caption" color="primary.main" fontWeight={700}>În expediere</Typography>
          <Typography variant="h5" color="primary.main">{summaryRows.filter(r => r.inExpediere).length} SKU</Typography>
          <Typography variant="caption" color="text.secondary">pregătit / încărcat</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180 }}><CardContent>
          <Typography variant="caption" color="text.secondary">% rămas din stoc</Typography>
          <Typography variant="h5">
            {totalInitial > 0 ? Math.round(totalCurrent / totalInitial * 100) : 0}%
          </Typography>
        </CardContent></Card>
      </Stack>

      {/* Per-SKU summary with breakdown */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Stoc agregat pe SKU — detaliu pe stare</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Produs</TableCell>
              <TableCell align="right">Loturi</TableCell>
              <TableCell align="right">Qty inițial</TableCell>
              <TableCell align="right" sx={{ color: 'success.main' }}>Disponibil</TableCell>
              <TableCell align="right" sx={{ color: 'warning.main' }}>Rezervat</TableCell>
              <TableCell align="right" sx={{ color: 'text.secondary' }}>Total curent</TableCell>
              <TableCell>În picking</TableCell>
              <TableCell>În expediere</TableCell>
              <TableCell>Utilizare</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryRows.map((r, i) => {
              const pct = r.totalInitial > 0 ? Math.round(r.totalCurrent / r.totalInitial * 100) : 0;
              const disponibil = r.totalCurrent - r.reserved;
              return (
                <TableRow key={i}>
                  <TableCell><strong>{r.sku}</strong></TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell align="right">{r.lots}</TableCell>
                  <TableCell align="right">{fmtNum(r.totalInitial, 0)}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} color={disponibil === 0 ? 'text.disabled' : 'success.main'}>
                      {fmtNum(Math.max(0, disponibil), 0)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {r.reserved > 0
                      ? <Typography fontWeight={700} color="warning.main">{fmtNum(r.reserved, 0)}</Typography>
                      : <Typography color="text.disabled">0</Typography>
                    }
                  </TableCell>
                  <TableCell align="right">
                    <Typography color={r.totalCurrent === 0 ? 'text.disabled' : r.totalCurrent < r.totalInitial * 0.1 ? 'error.main' : 'inherit'}>
                      {fmtNum(r.totalCurrent, 0)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.inPicking ? <Chip label="PICKING" size="small" color="info" /> : <Typography color="text.disabled" variant="caption">-</Typography>}
                  </TableCell>
                  <TableCell>
                    {r.inExpediere ? <Chip label="EXPEDIERE" size="small" color="primary" /> : <Typography color="text.disabled" variant="caption">-</Typography>}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={pct} sx={{ width: 80, height: 8, borderRadius: 4 }}
                        color={pct < 10 ? 'error' : pct < 30 ? 'warning' : 'success'} />
                      <Typography variant="caption">{pct}%</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {summaryRows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={10} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Detail by batch */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Detaliu loturi individuale</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Lot</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Qty init.</TableCell>
              <TableCell align="right">Disponibil</TableCell>
              <TableCell align="right">Rezervat</TableCell>
              <TableCell align="right">Total curent</TableCell>
              <TableCell align="right">Lungime (m)</TableCell>
              <TableCell>Locație</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => {
              const reserved = Number(r.reserved_quantity || 0);
              const current = Number(r.current_quantity || 0);
              return (
                <TableRow key={i}>
                  <TableCell><strong>{String(r.batch_number || '-')}</strong></TableCell>
                  <TableCell>{String(r.product_sku || '-')}</TableCell>
                  <TableCell align="right">{fmtNum(r.initial_quantity as number, 0)}</TableCell>
                  <TableCell align="right">
                    <Typography color="success.main" fontWeight={700}>{fmtNum(Math.max(0, current - reserved), 0)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    {reserved > 0
                      ? <Typography color="warning.main" fontWeight={700}>{fmtNum(reserved, 0)}</Typography>
                      : <Typography color="text.disabled">0</Typography>
                    }
                  </TableCell>
                  <TableCell align="right">{fmtNum(current, 0)}</TableCell>
                  <TableCell align="right">{r.length_meters ? `${fmtNum(r.length_meters as number)}m` : '-'}</TableCell>
                  <TableCell>{String(r.location_code || '-')}</TableCell>
                  <TableCell><Chip label={String(r.status || '-')} size="small" color={statusColors[String(r.status)] ?? 'default'} /></TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={9} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Stoc pe stare ───────────────────────────────────────────────────────

function StocPeStareTab() {
  type Row = Record<string, unknown>;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/batches', { params: { limit: 1000 } });
      const data = r.data?.data ?? r.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped: Record<string, { count: number; totalCurrent: number }> = {};
  for (const r of rows) {
    const s = String(r.status || 'UNKNOWN');
    if (!grouped[s]) grouped[s] = { count: 0, totalCurrent: 0 };
    grouped[s].count++;
    grouped[s].totalCurrent += Number(r.current_quantity || 0);
  }

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    INTACT: 'success', CUT: 'warning', REPACKED: 'info', EMPTY: 'default', DAMAGED: 'error', QUARANTINE: 'error',
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        {Object.entries(grouped).map(([status, { count, totalCurrent }]) => (
          <Card key={status} sx={{ minWidth: 180 }}>
            <CardContent>
              <Chip label={status} color={statusColors[status] ?? 'default'} size="small" sx={{ mb: 1 }} />
              <Typography variant="h5">{count} loturi</Typography>
              <Typography variant="body2" color="text.secondary">Qty: {fmtNum(totalCurrent, 0)}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell align="right">Nr. loturi</TableCell>
              <TableCell align="right">Cantitate totală</TableCell>
              <TableCell align="right">% din total loturi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(grouped).map(([status, { count, totalCurrent }]) => {
              const pct = rows.length > 0 ? Math.round(count / rows.length * 100) : 0;
              return (
                <TableRow key={status}>
                  <TableCell><Chip label={status} color={statusColors[status] ?? 'default'} size="small" /></TableCell>
                  <TableCell align="right">{count}</TableCell>
                  <TableCell align="right">{fmtNum(totalCurrent, 0)}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={pct} sx={{ width: 80, height: 6, borderRadius: 3 }} />
                      <Typography variant="caption">{pct}%</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Stoc pe lot / SKU', component: <StocPeLotTab /> },
  { label: 'Stoc pe stare', component: <StocPeStareTab /> },
];

export default function StockReportsPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <StorageIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Rapoarte Stoc & Loturi</Typography>
          <Typography variant="body2" color="text.secondary">
            Stoc curent pe lot, locație și stare — vizualizare completă
          </Typography>
        </Box>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        {TABS.map((t, i) => <Tab key={i} label={t.label} />)}
      </Tabs>
      {TABS[tab].component}
    </Box>
  );
}
