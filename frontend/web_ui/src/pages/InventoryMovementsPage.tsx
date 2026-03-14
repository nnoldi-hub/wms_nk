import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, Alert, TextField, Button,
  Stack, MenuItem, Select, FormControl, InputLabel, Divider, Card, CardContent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import axios from 'axios';

const API = 'http://localhost:3011/api/v1';

function authClient() {
  const token = localStorage.getItem('accessToken');
  return axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtNum(n: number | string | null | undefined, dec = 2) {
  if (n == null || n === '') return '-';
  return Number(n).toFixed(dec);
}

// ─── Tab: Mișcări pe produs / lot ─────────────────────────────────────────────

function MiscariBatchTab() {
  type Row = Record<string, unknown>;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [tipMiscare, setTipMiscare] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = { limit: '1000' };
      if (skuFilter) params.sku = skuFilter;
      if (statusFilter) params.status = statusFilter;
      const r = await authClient().get('/batches', { params });
      const data = r.data?.data ?? r.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [skuFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    INTACT: 'success', CUT: 'warning', REPACKED: 'info', EMPTY: 'default', DAMAGED: 'error', QUARANTINE: 'error',
  };

  // Movement type mapping based on status
  const tipMiscareMap: Record<string, string> = {
    INTACT: 'RECEPTIE', CUT: 'TAIERE', REPACKED: 'REAMBALARE', EMPTY: 'EXPEDIERE', DAMAGED: 'DETERIORARE', QUARANTINE: 'CARANTINA',
  };

  // Client-side filtering
  const filtered = rows.filter(r => {
    if (lotFilter && !String(r.batch_number || '').toLowerCase().includes(lotFilter.toLowerCase())) return false;
    if (locationFilter && !String(r.location_code || r.zone_code || '').toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (operatorFilter && !String(r.received_by || r.created_by || '').toLowerCase().includes(operatorFilter.toLowerCase())) return false;
    if (tipMiscare) {
      const mt = tipMiscareMap[String(r.status)] || '';
      if (mt !== tipMiscare) return false;
    }
    if (dateFrom || dateTo) {
      const d = r.received_at ?? r.created_at;
      if (!d) return false;
      const dt = new Date(d as string);
      if (dateFrom && dt < new Date(dateFrom)) return false;
      if (dateTo && dt > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <TextField label="SKU produs" size="small" value={skuFilter} onChange={e => setSkuFilter(e.target.value)} sx={{ width: 160 }} />
        <TextField label="Nr. lot" size="small" value={lotFilter} onChange={e => setLotFilter(e.target.value)} sx={{ width: 160 }} />
        <TextField label="Locație" size="small" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} sx={{ width: 140 }} />
        <TextField label="Operator" size="small" value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} sx={{ width: 140 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Tip mișcare</InputLabel>
          <Select value={tipMiscare} label="Tip mișcare" onChange={e => setTipMiscare(e.target.value as string)}>
            <MenuItem value="">Toate</MenuItem>
            {['RECEPTIE', 'TAIERE', 'REAMBALARE', 'EXPEDIERE', 'DETERIORARE', 'CARANTINA'].map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status lot</InputLabel>
          <Select value={statusFilter} label="Status lot" onChange={e => setStatusFilter(e.target.value as string)}>
            <MenuItem value="">Toate</MenuItem>
            {['INTACT', 'CUT', 'REPACKED', 'EMPTY', 'DAMAGED', 'QUARANTINE'].map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <TextField label="De la" type="date" size="small" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField label="Până la" type="date" size="small" value={dateTo} onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
        {(lotFilter || locationFilter || operatorFilter || tipMiscare || dateFrom || dateTo) && (
          <Button size="small" color="warning" onClick={() => { setLotFilter(''); setLocationFilter(''); setOperatorFilter(''); setTipMiscare(''); setDateFrom(''); setDateTo(''); }}>
            Resetează filtre
          </Button>
        )}
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {filtered.length} loturi {filtered.length !== rows.length ? `(din ${rows.length} total)` : ''}
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Lot / Batch</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Produs</TableCell>
              <TableCell align="right">Qty inițial</TableCell>
              <TableCell align="right">Qty curent</TableCell>
              <TableCell align="right">Lungime (m)</TableCell>
              <TableCell align="right">Greutate (kg)</TableCell>
              <TableCell>Locație</TableCell>
              <TableCell>Tip mișcare</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Recepționat la</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={i}>
                <TableCell><strong>{String(r.batch_number || '-')}</strong></TableCell>
                <TableCell>{String(r.product_sku || '-')}</TableCell>
                <TableCell>{String(r.product_name || r.product_sku || '-')}</TableCell>
                <TableCell align="right">{fmtNum(r.initial_quantity as number, 0)}</TableCell>
                <TableCell align="right">
                  <Typography fontWeight={Number(r.current_quantity) < Number(r.initial_quantity) * 0.1 ? 700 : 400}
                    color={Number(r.current_quantity) === 0 ? 'text.disabled' : 'inherit'}>
                    {fmtNum(r.current_quantity as number, 0)}
                  </Typography>
                </TableCell>
                <TableCell align="right">{r.length_meters ? `${fmtNum(r.length_meters as number)}m` : '-'}</TableCell>
                <TableCell align="right">{r.weight_kg ? `${fmtNum(r.weight_kg as number)}kg` : '-'}</TableCell>
                <TableCell>{String(r.location_code || r.zone_code || '-')}</TableCell>
                <TableCell>
                  <Chip label={tipMiscareMap[String(r.status)] || String(r.status || '-')} size="small" variant="outlined" color="info" />
                </TableCell>
                <TableCell>
                  <Chip label={String(r.status || '-')} color={statusColors[String(r.status)] ?? 'default'} size="small" />
                </TableCell>
                <TableCell>{fmtDate(r.received_at as string ?? r.created_at as string)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={11} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Mișcări pe comandă ──────────────────────────────────────────────────

function MiscariComenziTab() {
  type Row = Record<string, unknown>;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { limit: 500 };
      if (statusFilter) params.status = statusFilter;
      const r = await authClient().get('/orders', { params });
      const data = r.data?.data ?? r.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    PENDING: 'default', CONFIRMED: 'info', PICKING: 'warning',
    READY_FOR_LOADING: 'warning', LOADED: 'info', DELIVERED: 'success', CANCELLED: 'error',
  };

  const filtered = rows.filter(r => {
    if (orderFilter && !String(r.number || '').toLowerCase().includes(orderFilter.toLowerCase())) return false;
    if (clientFilter && !String(r.partner_name || r.customer_name || '').toLowerCase().includes(clientFilter.toLowerCase())) return false;
    if (dateFrom || dateTo) {
      const d = r.created_at;
      if (!d) return false;
      const dt = new Date(d as string);
      if (dateFrom && dt < new Date(dateFrom)) return false;
      if (dateTo && dt > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
        <TextField label="Nr. comandă" size="small" value={orderFilter} onChange={e => setOrderFilter(e.target.value)} sx={{ width: 160 }} />
        <TextField label="Client" size="small" value={clientFilter} onChange={e => setClientFilter(e.target.value)} sx={{ width: 180 }} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status comandă</InputLabel>
          <Select value={statusFilter} label="Status comandă" onChange={e => setStatusFilter(e.target.value as string)}>
            <MenuItem value="">Toate</MenuItem>
            {['PENDING', 'CONFIRMED', 'PICKING', 'READY_FOR_LOADING', 'LOADED', 'DELIVERED', 'CANCELLED'].map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <TextField label="De la" type="date" size="small" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField label="Până la" type="date" size="small" value={dateTo} onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
        {(orderFilter || clientFilter || dateFrom || dateTo) && (
          <Button size="small" color="warning" onClick={() => { setOrderFilter(''); setClientFilter(''); setDateFrom(''); setDateTo(''); }}>
            Resetează filtre
          </Button>
        )}
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {filtered.length} comenzi {filtered.length !== rows.length ? `(din ${rows.length} total)` : ''}
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Nr. Comandă</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Agent</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Prioritate</TableCell>
              <TableCell>Data livrare</TableCell>
              <TableCell>Creat la</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={i}>
                <TableCell><strong>{String(r.number || '-')}</strong></TableCell>
                <TableCell>{String(r.partner_name || r.customer_name || '-')}</TableCell>
                <TableCell>{String(r.agent_name || '-')}</TableCell>
                <TableCell>
                  <Chip label={String(r.status || '-')} color={statusColors[String(r.status)] ?? 'default'} size="small" />
                </TableCell>
                <TableCell>
                  {(r.priority as string) ? (
                    <Chip label={String(r.priority)} size="small"
                      color={(r.priority as string) === 'URGENT' ? 'error' : (r.priority as string) === 'HIGH' ? 'warning' : 'default'} />
                  ) : null}
                </TableCell>
                <TableCell>{fmtDate(r.delivery_date as string)}</TableCell>
                <TableCell>{fmtDate(r.created_at as string)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Transformări (Tăieri) ───────────────────────────────────────────────

function TransformariTab() {
  type Row = Record<string, unknown>;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/transformations', { params: { limit: 300 } });
      const data = r.data?.data ?? r.data ?? [];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>{rows.length} transformări / tăieri</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Nr. Transformare</TableCell>
              <TableCell>Tip</TableCell>
              <TableCell>SKU sursă</TableCell>
              <TableCell>Lot sursă</TableCell>
              <TableCell align="right">Qty sursă</TableCell>
              <TableCell align="right">Qty rezultat</TableCell>
              <TableCell>Operator</TableCell>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell><strong>{String(r.transformation_number || r.number || '-')}</strong></TableCell>
                <TableCell><Chip label={String(r.transformation_type || r.type || 'CUT')} size="small" color="info" /></TableCell>
                <TableCell>{String(r.source_sku || r.product_sku || '-')}</TableCell>
                <TableCell>{String(r.source_batch_number || r.source_batch || '-')}</TableCell>
                <TableCell align="right">{fmtNum(r.source_quantity as number)}</TableCell>
                <TableCell align="right">{fmtNum(r.result_quantity as number ?? r.cut_quantity as number)}</TableCell>
                <TableCell>{String(r.performed_by || r.created_by || '-')}</TableCell>
                <TableCell>{fmtDate(r.created_at as string)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.disabled' }}>Nicio transformare înregistrată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Mișcări pe operator ─────────────────────────────────────────────────

function MiscariOperatorTab() {
  type Job = Record<string, unknown>;
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/pick-jobs', { params: { limit: 500 } });
      const data = r.data?.data ?? r.data ?? [];
      let jobs = Array.isArray(data) ? data : [];
      // filter by date range
      if (dateFrom || dateTo) {
        jobs = jobs.filter((j: Job) => {
          const d = j.completed_at ?? j.created_at;
          if (!d) return false;
          const dt = new Date(d as string);
          if (dateFrom && dt < new Date(dateFrom)) return false;
          if (dateTo && dt > new Date(dateTo + 'T23:59:59')) return false;
          return true;
        });
      }
      // group by operator
      const byOp: Record<string, { total: number; completed: number; totalTime: number; cancelled: number }> = {};
      for (const j of jobs) {
        const op = String(j.assigned_to || 'Nealocat');
        if (!byOp[op]) byOp[op] = { total: 0, completed: 0, totalTime: 0, cancelled: 0 };
        byOp[op].total++;
        if (j.status === 'COMPLETED') {
          byOp[op].completed++;
          if (j.started_at && j.completed_at) {
            const ms = new Date(j.completed_at as string).getTime() - new Date(j.started_at as string).getTime();
            if (ms > 0) byOp[op].totalTime += ms;
          }
        }
        if (j.status === 'CANCELLED') byOp[op].cancelled++;
      }
      setRows(Object.entries(byOp).map(([op, v]) => ({ operator: op, ...v })));
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <TextField label="De la" type="date" size="small" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField label="Până la" type="date" size="small" value={dateTo} onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Operator</TableCell>
              <TableCell align="right">Total joburi</TableCell>
              <TableCell align="right">Finalizate</TableCell>
              <TableCell align="right">Anulate</TableCell>
              <TableCell align="right">Rată completare</TableCell>
              <TableCell align="right">Timp mediu picking</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => {
              const rate = (r.total as number) ? Math.round((r.completed as number) / (r.total as number) * 100) : 0;
              const avgMin = (r.completed as number) > 0
                ? Math.round(((r.totalTime as number) / (r.completed as number)) / 60000)
                : 0;
              return (
                <TableRow key={i}>
                  <TableCell><strong>{String(r.operator)}</strong></TableCell>
                  <TableCell align="right">{String(r.total)}</TableCell>
                  <TableCell align="right">{String(r.completed)}</TableCell>
                  <TableCell align="right">
                    <Typography color={(r.cancelled as number) > 0 ? 'error.main' : 'inherit'}>
                      {String(r.cancelled)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={rate} sx={{ width: 60, height: 6, borderRadius: 3 }}
                        color={rate > 80 ? 'success' : rate > 50 ? 'warning' : 'error'} />
                      <Typography variant="caption">{rate}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{avgMin > 0 ? `${avgMin} min` : '-'}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Istoric complet produs ──────────────────────────────────────────────

function IstoricProdusTab() {
  type Row = Record<string, unknown>;
  const [sku, setSku] = useState('');
  const [searchSku, setSearchSku] = useState('');
  const [batches, setBatches] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [transformations, setTransformations] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback(async () => {
    if (!searchSku.trim()) return;
    setLoading(true); setError('');
    try {
      const [rb, ro, rt] = await Promise.all([
        authClient().get('/batches', { params: { limit: 500, sku: searchSku.trim() } }),
        authClient().get('/orders', { params: { limit: 500 } }),
        authClient().get('/transformations', { params: { limit: 300 } }),
      ]);
      const bData: Row[] = Array.isArray(rb.data?.data) ? rb.data.data : Array.isArray(rb.data) ? rb.data : [];
      const oData: Row[] = Array.isArray(ro.data?.data) ? ro.data.data : Array.isArray(ro.data) ? ro.data : [];
      const tData: Row[] = Array.isArray(rt.data?.data) ? rt.data.data : Array.isArray(rt.data) ? rt.data : [];
      const skuUpper = searchSku.trim().toUpperCase();
      setBatches(bData.filter(b => String(b.product_sku || '').toUpperCase().includes(skuUpper)));
      setOrders(oData.filter(o => {
        const lines = o.lines as Row[] | undefined;
        if (!Array.isArray(lines)) return false;
        return lines.some(l => String(l.product_sku || '').toUpperCase().includes(skuUpper));
      }));
      setTransformations(tData.filter(t => String(t.source_sku || t.product_sku || '').toUpperCase().includes(skuUpper)));
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [searchSku]);

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    INTACT: 'success', CUT: 'warning', REPACKED: 'info', EMPTY: 'default', DAMAGED: 'error', QUARANTINE: 'error',
  };
  const orderStatusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    PENDING: 'default', CONFIRMED: 'info', PICKING: 'warning',
    READY_FOR_LOADING: 'warning', LOADED: 'info', DELIVERED: 'success', CANCELLED: 'error',
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Introdu un SKU pentru a vedea ciclul complet al produsului: recepție → loturi → tăieri → comenzi livrate.
      </Alert>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <TextField
          label="SKU produs"
          size="small"
          value={sku}
          onChange={e => setSku(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setSearchSku(sku); } }}
          sx={{ width: 240 }}
          placeholder="ex: CABLU-001"
        />
        <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setSearchSku(sku)} disabled={!sku.trim()}>
          Caută istoric
        </Button>
        {searchSku && (
          <Button size="small" color="warning" onClick={() => { setSku(''); setSearchSku(''); setBatches([]); setOrders([]); setTransformations([]); }}>
            Resetează
          </Button>
        )}
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {searchSku && !loading && (
        <>
          {/* Summary */}
          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 3 }}>
            <Card sx={{ minWidth: 140 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Loturi recepționate</Typography>
              <Typography variant="h5">{batches.length}</Typography>
            </CardContent></Card>
            <Card sx={{ minWidth: 140 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Comenzi asociate</Typography>
              <Typography variant="h5">{orders.length}</Typography>
            </CardContent></Card>
            <Card sx={{ minWidth: 140 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Transformări (tăieri)</Typography>
              <Typography variant="h5">{transformations.length}</Typography>
            </CardContent></Card>
            <Card sx={{ minWidth: 180 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Qty totală recepționată</Typography>
              <Typography variant="h5">{fmtNum(batches.reduce((s, b) => s + Number(b.initial_quantity || 0), 0), 0)}</Typography>
            </CardContent></Card>
            <Card sx={{ minWidth: 180 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Qty curent în stoc</Typography>
              <Typography variant="h5" color="primary.main">{fmtNum(batches.reduce((s, b) => s + Number(b.current_quantity || 0), 0), 0)}</Typography>
            </CardContent></Card>
          </Stack>

          <Divider sx={{ mb: 2 }}><Chip label="RECEPȚIE — Loturi" size="small" color="success" /></Divider>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Lot</TableCell>
                  <TableCell align="right">Qty inițial</TableCell>
                  <TableCell align="right">Qty curent</TableCell>
                  <TableCell>Locație</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Recepționat la</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.disabled' }}>Niciun lot găsit</TableCell></TableRow>}
                {batches.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell><strong>{String(b.batch_number || '-')}</strong></TableCell>
                    <TableCell align="right">{fmtNum(b.initial_quantity as number, 0)}</TableCell>
                    <TableCell align="right">{fmtNum(b.current_quantity as number, 0)}</TableCell>
                    <TableCell>{String(b.location_code || '-')}</TableCell>
                    <TableCell><Chip label={String(b.status || '-')} size="small" color={statusColors[String(b.status)] ?? 'default'} /></TableCell>
                    <TableCell>{fmtDate(b.received_at as string ?? b.created_at as string)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ mb: 2 }}><Chip label="TRANSFORMĂRI — Tăieri / Reambalări" size="small" color="warning" /></Divider>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 260 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nr. transformare</TableCell>
                  <TableCell>Tip</TableCell>
                  <TableCell align="right">Qty sursă</TableCell>
                  <TableCell align="right">Qty rezultat</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transformations.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.disabled' }}>Nicio transformare</TableCell></TableRow>}
                {transformations.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell><strong>{String(t.transformation_number || t.number || '-')}</strong></TableCell>
                    <TableCell><Chip label={String(t.transformation_type || t.type || 'CUT')} size="small" color="info" /></TableCell>
                    <TableCell align="right">{fmtNum(t.source_quantity as number)}</TableCell>
                    <TableCell align="right">{fmtNum(t.result_quantity as number ?? t.cut_quantity as number)}</TableCell>
                    <TableCell>{String(t.performed_by || t.created_by || '-')}</TableCell>
                    <TableCell>{fmtDate(t.created_at as string)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ mb: 2 }}><Chip label="EXPEDIERE — Comenzi" size="small" color="primary" /></Divider>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nr. Comandă</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Data creare</TableCell>
                  <TableCell>Livrat la</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.disabled' }}>Nicio comandă</TableCell></TableRow>}
                {orders.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell><strong>{String(o.number || '-')}</strong></TableCell>
                    <TableCell>{String(o.partner_name || o.customer_name || '-')}</TableCell>
                    <TableCell><Chip label={String(o.status || '-')} size="small" color={orderStatusColors[String(o.status)] ?? 'default'} /></TableCell>
                    <TableCell>{fmtDate(o.created_at as string)}</TableCell>
                    <TableCell>{fmtDate(o.delivered_at as string)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {!searchSku && !loading && (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <HistoryIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography>Introdu un SKU și apasă "Caută istoric" pentru a vedea ciclul complet al produsului</Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Mișcări loturi', component: <MiscariBatchTab /> },
  { label: 'Mișcări comenzi', component: <MiscariComenziTab /> },
  { label: 'Transformări / Tăieri', component: <TransformariTab /> },
  { label: 'Pe operator', component: <MiscariOperatorTab /> },
  { label: 'Istoric produs', component: <IstoricProdusTab /> },
];

export default function InventoryMovementsPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <SwapHorizIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Mișcări Inventar</Typography>
          <Typography variant="body2" color="text.secondary">
            Istoric complet — loturi, comenzi, tăieri, activitate operatori
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
