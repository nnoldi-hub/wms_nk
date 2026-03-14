import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, Alert, Button,
  Stack, Card, CardContent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
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

// ─── Tab: Predicții consum (cele mai consumate SKU-uri) ───────────────────────

function PredictiiConsumTab() {
  type Row = Record<string, unknown>;
  const [batches, setBatches] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rb, ro] = await Promise.allSettled([
        authClient().get('/batches', { params: { limit: 1000 } }),
        authClient().get('/orders', { params: { limit: 500 } }),
      ]);
      if (rb.status === 'fulfilled') {
        setBatches(Array.isArray(rb.value.data?.data) ? rb.value.data.data : Array.isArray(rb.value.data) ? rb.value.data : []);
      } else {
        setError((rb.reason as Error)?.message || 'Eroare la loturi');
      }
      if (ro.status === 'fulfilled') {
        setOrders(Array.isArray(ro.value.data?.data) ? ro.value.data.data : Array.isArray(ro.value.data) ? ro.value.data : []);
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();

  // Build per-SKU stats with daily/weekly rates
  const bySku: Record<string, {
    sku: string; name: string; totalInit: number; totalCurrent: number;
    lots: number; cutLots: number; emptyLots: number;
    oldestReceived: number; // timestamp ms of oldest batch
    consumed: number;
  }> = {};

  for (const b of batches) {
    const sku = String(b.product_sku || '-');
    if (!bySku[sku]) bySku[sku] = {
      sku, name: String(b.product_name || sku), totalInit: 0, totalCurrent: 0,
      lots: 0, cutLots: 0, emptyLots: 0, oldestReceived: now, consumed: 0,
    };
    bySku[sku].totalInit += Number(b.initial_quantity || 0);
    bySku[sku].totalCurrent += Number(b.current_quantity || 0);
    bySku[sku].consumed += Math.max(0, Number(b.initial_quantity || 0) - Number(b.current_quantity || 0));
    bySku[sku].lots++;
    if (b.status === 'CUT') bySku[sku].cutLots++;
    if (b.status === 'EMPTY') bySku[sku].emptyLots++;
    const received = b.received_at ?? b.created_at;
    if (received) {
      const ts = new Date(received as string).getTime();
      if (ts < bySku[sku].oldestReceived) bySku[sku].oldestReceived = ts;
    }
  }

  // Count order frequency
  const orderFreq: Record<string, number> = {};
  for (const o of orders) {
    const lines = o.lines as Row[] | undefined;
    if (lines && Array.isArray(lines)) {
      for (const l of lines) {
        const sku = String(l.product_sku || '-');
        orderFreq[sku] = (orderFreq[sku] || 0) + 1;
      }
    }
  }

  const rows = Object.values(bySku).map(r => {
    const daysSinceReceipt = Math.max(1, (now - r.oldestReceived) / 86400000);
    const dailyRate = r.consumed / daysSinceReceipt;
    const weeklyRate = dailyRate * 7;
    const daysToDepletion = dailyRate > 0 ? Math.round(r.totalCurrent / dailyRate) : 999;
    const consumptionPct = r.totalInit > 0 ? Math.round((r.totalInit - r.totalCurrent) / r.totalInit * 100) : 0;
    let recommendation = '';
    if (r.totalCurrent === 0) recommendation = 'EPUIZAT';
    else if (daysToDepletion < 7) recommendation = 'Reaprovizionare URGENTĂ';
    else if (daysToDepletion < 30) recommendation = 'Reaprovizionare în curând';
    else if (daysToDepletion < 90) recommendation = 'Stoc OK';
    else recommendation = 'Stoc suficient';
    return {
      ...r,
      consumptionPct, orderCount: orderFreq[r.sku] || 0,
      dailyRate, weeklyRate, daysToDepletion, recommendation,
    };
  }).sort((a, b) => b.consumptionPct - a.consumptionPct);

  const urgentCount = rows.filter(r => r.daysToDepletion < 30 && r.totalCurrent > 0).length;
  const depleted = rows.filter(r => r.totalCurrent === 0).length;

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Estimările se bazează pe rata de consum istorică per SKU (cantitate consumată / zile de la prima recepție).
      </Alert>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">SKU-uri analizate</Typography>
          <Typography variant="h5">{rows.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: urgentCount > 0 ? 'error.50' : 'inherit' }}><CardContent>
          <Typography variant="caption" color={urgentCount > 0 ? 'error.main' : 'text.secondary'} fontWeight={urgentCount > 0 ? 700 : 400}>
            Reaprovizionare urgentă (&lt;30z)
          </Typography>
          <Typography variant="h5" color={urgentCount > 0 ? 'error.main' : 'inherit'}>{urgentCount}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160, bgcolor: depleted > 0 ? 'error.50' : 'inherit' }}><CardContent>
          <Typography variant="caption" color={depleted > 0 ? 'error.main' : 'text.secondary'} fontWeight={depleted > 0 ? 700 : 400}>
            SKU-uri epuizate
          </Typography>
          <Typography variant="h5" color={depleted > 0 ? 'error.main' : 'inherit'}>{depleted}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 200 }}><CardContent>
          <Typography variant="caption" color="text.secondary">SKU-uri stoc suficient (&gt;90z)</Typography>
          <Typography variant="h5" color="success.main">{rows.filter(r => r.daysToDepletion >= 90 && r.totalCurrent > 0).length}</Typography>
        </CardContent></Card>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Produs</TableCell>
              <TableCell align="right">Qty rămas</TableCell>
              <TableCell align="right">Consum zilnic</TableCell>
              <TableCell align="right">Consum săptămânal</TableCell>
              <TableCell align="right">Zile până epuizare</TableCell>
              <TableCell>Consum %</TableCell>
              <TableCell>Cerere comenzi</TableCell>
              <TableCell>Recomandare</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} sx={{ bgcolor: r.daysToDepletion < 7 && r.totalCurrent > 0 ? '#fff5f5' : r.daysToDepletion < 30 && r.totalCurrent > 0 ? '#fffbeb' : 'inherit' }}>
                <TableCell><strong>{r.sku}</strong></TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell align="right">
                  <Typography fontWeight={700} color={r.totalCurrent === 0 ? 'text.disabled' : r.daysToDepletion < 30 ? 'error.main' : 'inherit'}>
                    {fmtNum(r.totalCurrent, 0)}
                  </Typography>
                </TableCell>
                <TableCell align="right">{r.dailyRate > 0 ? fmtNum(r.dailyRate) : '-'}</TableCell>
                <TableCell align="right">{r.weeklyRate > 0 ? fmtNum(r.weeklyRate) : '-'}</TableCell>
                <TableCell align="right">
                  {r.totalCurrent === 0
                    ? <Chip label="EPUIZAT" size="small" color="error" />
                    : r.daysToDepletion >= 999
                    ? <Typography color="success.main">∞</Typography>
                    : <Chip label={`${r.daysToDepletion}z`} size="small"
                        color={r.daysToDepletion < 7 ? 'error' : r.daysToDepletion < 30 ? 'warning' : 'success'} />
                  }
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress variant="determinate" value={r.consumptionPct} sx={{ width: 80, height: 8, borderRadius: 4 }}
                      color={r.consumptionPct > 80 ? 'error' : r.consumptionPct > 50 ? 'warning' : 'success'} />
                    <Typography variant="caption" fontWeight={700}>{r.consumptionPct}%</Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  {r.orderCount > 0 ? <Chip label={`${r.orderCount} linii`} size="small" color="info" /> : '-'}
                </TableCell>
                <TableCell>
                  {r.recommendation === 'EPUIZAT' ? (
                    <Chip label="EPUIZAT" color="error" size="small" />
                  ) : r.recommendation === 'Reaprovizionare URGENTĂ' ? (
                    <Chip icon={<WarningAmberIcon />} label="Urgent" color="error" size="small" />
                  ) : r.recommendation === 'Reaprovizionare în curând' ? (
                    <Chip label="Reaprovizionare" color="warning" size="small" />
                  ) : r.recommendation === 'Stoc OK' ? (
                    <Chip label="Stoc OK" color="info" size="small" />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={9} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Stoc critic (produse pe cale de epuizare) ──────────────────────────

function StocCriticTab() {
  type Row = Record<string, unknown>;
  const [batches, setBatches] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/batches', { params: { limit: 1000 } });
      const data = r.data?.data ?? r.data ?? [];
      setBatches(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by SKU, find ones where remaining < 10% of initial
  const bySku: Record<string, { sku: string; name: string; totalInit: number; totalCurrent: number; lots: number; activeLots: number }> = {};
  for (const b of batches) {
    if (b.status === 'EMPTY' || b.status === 'DAMAGED') continue;
    const sku = String(b.product_sku || '-');
    if (!bySku[sku]) bySku[sku] = { sku, name: String(b.product_name || sku), totalInit: 0, totalCurrent: 0, lots: 0, activeLots: 0 };
    bySku[sku].totalInit += Number(b.initial_quantity || 0);
    bySku[sku].totalCurrent += Number(b.current_quantity || 0);
    bySku[sku].lots++;
    if (Number(b.current_quantity) > 0) bySku[sku].activeLots++;
  }

  const criticalRows = Object.values(bySku)
    .filter(r => r.totalInit > 0 && (r.totalCurrent / r.totalInit) < 0.15)
    .sort((a, b) => (a.totalCurrent / a.totalInit) - (b.totalCurrent / b.totalInit));

  const warningRows = Object.values(bySku)
    .filter(r => r.totalInit > 0 && (r.totalCurrent / r.totalInit) >= 0.15 && (r.totalCurrent / r.totalInit) < 0.30)
    .sort((a, b) => (a.totalCurrent / a.totalInit) - (b.totalCurrent / b.totalInit));

  function StockSection({ title, rows, severity }: { title: string; rows: typeof criticalRows; severity: 'error' | 'warning' }) {
    if (rows.length === 0) return null;
    return (
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <TrendingDownIcon color={severity} />
          <Typography variant="subtitle1" fontWeight={700} color={`${severity}.main`}>{title}</Typography>
          <Chip label={rows.length} color={severity} size="small" />
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>SKU</TableCell>
                <TableCell>Produs</TableCell>
                <TableCell align="right">Qty inițial</TableCell>
                <TableCell align="right">Qty curent</TableCell>
                <TableCell align="right">% rămas</TableCell>
                <TableCell align="right">Loturi active</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => {
                const pct = Math.round(r.totalCurrent / r.totalInit * 100);
                return (
                  <TableRow key={i}>
                    <TableCell><strong>{r.sku}</strong></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell align="right">{fmtNum(r.totalInit, 0)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color={pct === 0 ? 'text.disabled' : `${severity}.main`}>
                        {fmtNum(r.totalCurrent, 0)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={pct} sx={{ width: 60, height: 8, borderRadius: 4 }} color={severity} />
                        <Typography variant="caption" fontWeight={700}>{pct}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">{r.activeLots} / {r.lots}</TableCell>
                    <TableCell>
                      <Chip
                        icon={<WarningAmberIcon />}
                        label={pct === 0 ? 'EPUIZAT' : pct < 5 ? 'CRITIC' : 'Scăzut'}
                        color={severity}
                        size="small"
                      />
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

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {criticalRows.length === 0 && warningRows.length === 0 && !loading && (
        <Alert severity="success">Toate produsele au stoc sufficient (peste 30% din cantitatea inițială).</Alert>
      )}

      <StockSection title="Stoc CRITIC (&lt;15% din inițial)" rows={criticalRows} severity="error" />
      <StockSection title="Stoc SCĂZUT (15%–30% din inițial)" rows={warningRows} severity="warning" />
    </Box>
  );
}

// ─── Tab: Produse stagnante (stau prea mult) ──────────────────────────────────

function ProduseStagnanteTab() {
  type Row = Record<string, unknown>;
  const [batches, setBatches] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const STAGNANT_DAYS = 60;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/batches', { params: { limit: 1000 } });
      const data = r.data?.data ?? r.data ?? [];
      setBatches(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();

  function getAgeDays(b: Record<string, unknown>): number {
    const created = b.received_at ?? b.created_at;
    if (!created) return 0;
    return Math.floor((now - new Date(created as string).getTime()) / 86400000);
  }

  const stagnant = batches.filter(b => {
    if (b.status === 'EMPTY' || b.status === 'DAMAGED') return false;
    if (Number(b.current_quantity) === 0) return false;
    if (!b.received_at && !b.created_at) return false;
    return getAgeDays(b) > STAGNANT_DAYS;
  }).sort((a, b2) => getAgeDays(b2) - getAgeDays(a));

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    INTACT: 'success', CUT: 'warning', REPACKED: 'info', EMPTY: 'default', DAMAGED: 'error',
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Produse cu stoc &gt; 0 care nu au mai ieșit din depozit de peste <strong>{STAGNANT_DAYS} de zile</strong>. Acestea ocupă spațiu inutil și ar trebui relocate sau evaluate.
      </Alert>

      {stagnant.length === 0 && !loading && (
        <Alert severity="success">Nu există produse stagnante în depozit.</Alert>
      )}

      {stagnant.length > 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Card sx={{ minWidth: 160 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Loturi stagnante</Typography>
              <Typography variant="h5" color="warning.main">{stagnant.length}</Typography>
            </CardContent></Card>
            <Card sx={{ minWidth: 160 }}><CardContent>
              <Typography variant="caption" color="text.secondary">Cel mai vechi (zile)</Typography>
              <Typography variant="h5" color="error.main">{stagnant[0] ? getAgeDays(stagnant[0]) : 0}z</Typography>
            </CardContent></Card>
          </Stack>

          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Lot</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="right">Qty curent</TableCell>
                  <TableCell align="right">Lungime (m)</TableCell>
                  <TableCell>Locație</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Vârstă (zile)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stagnant.map((r, i) => {
                  const ageDays = getAgeDays(r);
                  return (
                  <TableRow key={i} sx={{ bgcolor: ageDays > 180 ? '#fff5f5' : '#fffbeb' }}>
                    <TableCell><strong>{String(r.batch_number || '-')}</strong></TableCell>
                    <TableCell>{String(r.product_sku || '-')}</TableCell>
                    <TableCell align="right">{fmtNum(r.current_quantity as number, 0)}</TableCell>
                    <TableCell align="right">{r.length_meters ? `${fmtNum(r.length_meters as number)}m` : '-'}</TableCell>
                    <TableCell>{String(r.location_code || '-')}</TableCell>
                    <TableCell><Chip label={String(r.status || '-')} size="small" color={statusColors[String(r.status)] ?? 'default'} /></TableCell>
                    <TableCell align="right">
                      <Chip label={`${ageDays}z`} size="small"
                        color={ageDays > 180 ? 'error' : 'warning'} />
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

// ─── Tab: Top Rotație Mare ────────────────────────────────────────────────────

function TopRotatieMareTab() {
  type Row = Record<string, unknown>;
  const [batches, setBatches] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/batches', { params: { limit: 1000 } });
      const data = r.data?.data ?? r.data ?? [];
      setBatches(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();

  const bySku: Record<string, { sku: string; name: string; totalInit: number; totalCurrent: number; consumed: number; oldestReceived: number }> = {};
  for (const b of batches) {
    const sku = String(b.product_sku || '-');
    if (!bySku[sku]) bySku[sku] = { sku, name: String(b.product_name || sku), totalInit: 0, totalCurrent: 0, consumed: 0, oldestReceived: now };
    bySku[sku].totalInit += Number(b.initial_quantity || 0);
    bySku[sku].totalCurrent += Number(b.current_quantity || 0);
    bySku[sku].consumed += Math.max(0, Number(b.initial_quantity || 0) - Number(b.current_quantity || 0));
    const received = b.received_at ?? b.created_at;
    if (received) {
      const ts = new Date(received as string).getTime();
      if (ts < bySku[sku].oldestReceived) bySku[sku].oldestReceived = ts;
    }
  }

  const rows = Object.values(bySku).map(r => {
    const daysSinceReceipt = Math.max(1, (now - r.oldestReceived) / 86400000);
    const dailyRate = r.consumed / daysSinceReceipt;
    const weeklyRate = dailyRate * 7;
    return { ...r, dailyRate, weeklyRate };
  })
    .filter(r => r.dailyRate > 0)
    .sort((a, b) => b.dailyRate - a.dailyRate)
    .slice(0, 20);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 2 }}>
        Top 20 produse cu cea mai mare rată de consum zilnic. Acestea necesită reaprovizionare frecventă.
      </Alert>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Produs</TableCell>
              <TableCell align="right">Qty rămas</TableCell>
              <TableCell align="right">Consumat total</TableCell>
              <TableCell align="right">Rată zilnică</TableCell>
              <TableCell align="right">Rată săptămânală</TableCell>
              <TableCell>Rotație</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell><Chip label={i + 1} size="small" color={i < 3 ? 'error' : i < 10 ? 'warning' : 'default'} /></TableCell>
                <TableCell><strong>{r.sku}</strong></TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell align="right">{fmtNum(r.totalCurrent, 0)}</TableCell>
                <TableCell align="right">{fmtNum(r.consumed, 0)}</TableCell>
                <TableCell align="right"><Typography fontWeight={700} color="error.main">{fmtNum(r.dailyRate)}/zi</Typography></TableCell>
                <TableCell align="right">{fmtNum(r.weeklyRate)}/săpt.</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress variant="determinate"
                      value={Math.min(100, (r.dailyRate / (rows[0]?.dailyRate || 1)) * 100)}
                      sx={{ width: 80, height: 8, borderRadius: 4 }} color="error" />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.disabled' }}>Nicio dată disponibilă</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Top Rotație Mică ────────────────────────────────────────────────────

function TopRotatieMicaTab() {
  type Row = Record<string, unknown>;
  const [batches, setBatches] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/batches', { params: { limit: 1000 } });
      const data = r.data?.data ?? r.data ?? [];
      setBatches(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();

  const bySku: Record<string, { sku: string; name: string; totalInit: number; totalCurrent: number; consumed: number; oldestReceived: number }> = {};
  for (const b of batches) {
    if (b.status === 'EMPTY' || b.status === 'DAMAGED') continue;
    if (Number(b.current_quantity) === 0) continue;
    const sku = String(b.product_sku || '-');
    if (!bySku[sku]) bySku[sku] = { sku, name: String(b.product_name || sku), totalInit: 0, totalCurrent: 0, consumed: 0, oldestReceived: now };
    bySku[sku].totalInit += Number(b.initial_quantity || 0);
    bySku[sku].totalCurrent += Number(b.current_quantity || 0);
    bySku[sku].consumed += Math.max(0, Number(b.initial_quantity || 0) - Number(b.current_quantity || 0));
    const received = b.received_at ?? b.created_at;
    if (received) {
      const ts = new Date(received as string).getTime();
      if (ts < bySku[sku].oldestReceived) bySku[sku].oldestReceived = ts;
    }
  }

  const rows = Object.values(bySku).map(r => {
    const daysSinceReceipt = Math.max(1, (now - r.oldestReceived) / 86400000);
    const dailyRate = r.consumed / daysSinceReceipt;
    const weeklyRate = dailyRate * 7;
    return { ...r, dailyRate, weeklyRate, daysSinceReceipt: Math.floor(daysSinceReceipt) };
  })
    .filter(r => r.totalCurrent > 0)
    .sort((a, b) => a.dailyRate - b.dailyRate)
    .slice(0, 20);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Alert severity="warning" sx={{ mb: 2 }}>
        Produse cu stoc activ dar cu rată de consum foarte mică. Pot indica suprastoc sau produse cu cerere scăzută.
      </Alert>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Produs</TableCell>
              <TableCell align="right">Qty curent</TableCell>
              <TableCell align="right">Zile în stoc</TableCell>
              <TableCell align="right">Rată zilnică</TableCell>
              <TableCell align="right">Rată săptămânală</TableCell>
              <TableCell>Alertă</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} sx={{ bgcolor: r.dailyRate === 0 ? '#fffbeb' : 'inherit' }}>
                <TableCell><Chip label={i + 1} size="small" color="default" /></TableCell>
                <TableCell><strong>{r.sku}</strong></TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell align="right">{fmtNum(r.totalCurrent, 0)}</TableCell>
                <TableCell align="right">{r.daysSinceReceipt}z</TableCell>
                <TableCell align="right">
                  <Typography color={r.dailyRate === 0 ? 'text.disabled' : 'warning.main'}>
                    {r.dailyRate > 0 ? `${fmtNum(r.dailyRate)}/zi` : 'Fără consum'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {r.weeklyRate > 0 ? `${fmtNum(r.weeklyRate)}/săpt.` : '-'}
                </TableCell>
                <TableCell>
                  {r.dailyRate === 0
                    ? <Chip label="Stagnat" color="warning" size="small" />
                    : r.dailyRate < 0.1
                    ? <Chip label="Mișcare lentă" color="default" size="small" />
                    : null
                  }
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.disabled' }}>Nicio dată disponibilă</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Predicții consum', component: <PredictiiConsumTab /> },
  { label: 'Stoc critic', component: <StocCriticTab /> },
  { label: 'Produse stagnante', component: <ProduseStagnanteTab /> },
  { label: 'Top rotație mare', component: <TopRotatieMareTab /> },
  { label: 'Top rotație mică', component: <TopRotatieMicaTab /> },
];

export default function PredictionsPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <AutoGraphIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Predicții & Forecast</Typography>
          <Typography variant="body2" color="text.secondary">
            Analiză predictivă — consum, stoc critic, produse stagnante, estimări reaprovizionare
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
