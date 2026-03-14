import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, Alert, Button,
  Stack, Card, CardContent, TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SpeedIcon from '@mui/icons-material/Speed';
import axios from 'axios';

const API = 'http://localhost:3011/api/v1';

function authClient() {
  const token = localStorage.getItem('accessToken');
  return axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function fmtMin(ms: number) {
  if (!ms || ms <= 0) return '-';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Tab: Performanță Picking ─────────────────────────────────────────────────

function PickingPerfTab() {
  type Job = Record<string, unknown>;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string | number> = { limit: 500, status: 'COMPLETED' };
      const r = await authClient().get('/pick-jobs', { params });
      let data = r.data?.data ?? r.data ?? [];
      if (!Array.isArray(data)) data = [];
      // filter by date range
      if (from || to) {
        data = data.filter((j: Job) => {
          const d = j.completed_at ? new Date(j.completed_at as string) : null;
          if (!d) return false;
          if (from && d < new Date(from)) return false;
          if (to && d > new Date(to + 'T23:59:59')) return false;
          return true;
        });
      }
      setJobs(data);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const completedWithTime = jobs.filter(j => j.started_at && j.completed_at);
  const times = completedWithTime.map(j =>
    new Date(j.completed_at as string).getTime() - new Date(j.started_at as string).getTime()
  ).filter(ms => ms > 0);
  const avgMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const minMs = times.length > 0 ? Math.min(...times) : 0;
  const maxMs = times.length > 0 ? Math.max(...times) : 0;

  // By operator
  const byOp: Record<string, { jobs: number; times: number[] }> = {};
  for (const j of jobs) {
    const op = String(j.assigned_to || 'Nealocat');
    if (!byOp[op]) byOp[op] = { jobs: 0, times: [] };
    byOp[op].jobs++;
    if (j.started_at && j.completed_at) {
      const ms = new Date(j.completed_at as string).getTime() - new Date(j.started_at as string).getTime();
      if (ms > 0) byOp[op].times.push(ms);
    }
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField label="De la" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Până la" type="date" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Joburi finalizate</Typography>
          <Typography variant="h5">{jobs.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Timp mediu picking</Typography>
          <Typography variant="h5" color="primary.main">{fmtMin(avgMs)}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Cel mai rapid</Typography>
          <Typography variant="h5" color="success.main">{fmtMin(minMs)}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Cel mai lent</Typography>
          <Typography variant="h5" color="warning.main">{fmtMin(maxMs)}</Typography>
        </CardContent></Card>
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Productivitate pe operator</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Operator</TableCell>
              <TableCell align="right">Joburi</TableCell>
              <TableCell align="right">Cu timp măsurat</TableCell>
              <TableCell align="right">Timp mediu</TableCell>
              <TableCell align="right">Cel mai rapid</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(byOp).sort((a, b) => b[1].jobs - a[1].jobs).map(([op, v]) => {
              const avg = v.times.length > 0 ? v.times.reduce((a, b) => a + b) / v.times.length : 0;
              const min = v.times.length > 0 ? Math.min(...v.times) : 0;
              return (
                <TableRow key={op}>
                  <TableCell><strong>{op}</strong></TableCell>
                  <TableCell align="right">{v.jobs}</TableCell>
                  <TableCell align="right">{v.times.length}</TableCell>
                  <TableCell align="right">{fmtMin(avg)}</TableCell>
                  <TableCell align="right">{fmtMin(min)}</TableCell>
                </TableRow>
              );
            })}
            {Object.keys(byOp).length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Joburi recente</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Nr. Job</TableCell>
              <TableCell>Operator</TableCell>
              <TableCell>Început</TableCell>
              <TableCell>Finalizat</TableCell>
              <TableCell align="right">Durată</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.slice(0, 100).map((j, i) => {
              const dur = j.started_at && j.completed_at
                ? new Date(j.completed_at as string).getTime() - new Date(j.started_at as string).getTime()
                : 0;
              return (
                <TableRow key={i}>
                  <TableCell><strong>{String(j.number || '-')}</strong></TableCell>
                  <TableCell>{String(j.assigned_to || '-')}</TableCell>
                  <TableCell>{fmtDate(j.started_at as string)}</TableCell>
                  <TableCell>{fmtDate(j.completed_at as string)}</TableCell>
                  <TableCell align="right">
                    <Chip label={fmtMin(dur)} size="small"
                      color={dur > 0 && dur < 30 * 60000 ? 'success' : dur > 120 * 60000 ? 'error' : 'default'} />
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

// ─── Tab: Performanță Livrare ─────────────────────────────────────────────────

function LivrarePerformantaTab() {
  type Order = Record<string, unknown>;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await authClient().get('/orders', { params: { limit: 300, status: 'DELIVERED' } });
      const data = r.data?.data ?? r.data ?? [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Delivery time = delivered_at - created_at
  const withTime = orders.filter(o => o.created_at && o.delivered_at);
  const times = withTime.map(o =>
    new Date(o.delivered_at as string).getTime() - new Date(o.created_at as string).getTime()
  ).filter(ms => ms > 0);
  const avgMs = times.length > 0 ? times.reduce((a, b) => a + b) / times.length : 0;

  // by agent
  const byAgent: Record<string, { orders: number; times: number[] }> = {};
  for (const o of orders) {
    const ag = String(o.agent_name || 'Necunoscut');
    if (!byAgent[ag]) byAgent[ag] = { orders: 0, times: [] };
    byAgent[ag].orders++;
    if (o.created_at && o.delivered_at) {
      const ms = new Date(o.delivered_at as string).getTime() - new Date(o.created_at as string).getTime();
      if (ms > 0) byAgent[ag].times.push(ms);
    }
  }

  function fmtDays(ms: number) {
    if (!ms || ms <= 0) return '-';
    const h = Math.round(ms / 3600000);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}z ${h % 24}h`;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Comenzi livrate</Typography>
          <Typography variant="h5">{orders.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 200 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Timp mediu livrare</Typography>
          <Typography variant="h5" color="primary.main">{fmtDays(avgMs)}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Cu date complete</Typography>
          <Typography variant="h5">{withTime.length}</Typography>
        </CardContent></Card>
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Performanță pe agent</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell align="right">Comenzi livrate</TableCell>
              <TableCell align="right">Timp mediu livrare</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(byAgent).sort((a, b) => b[1].orders - a[1].orders).map(([ag, v]) => {
              const avg = v.times.length > 0 ? v.times.reduce((a, b) => a + b) / v.times.length : 0;
              return (
                <TableRow key={ag}>
                  <TableCell><strong>{ag}</strong></TableCell>
                  <TableCell align="right">{v.orders}</TableCell>
                  <TableCell align="right">{fmtDays(avg)}</TableCell>
                </TableRow>
              );
            })}
            {Object.keys(byAgent).length === 0 && !loading && (
              <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.disabled' }}>Nicio comandă livrată înregistrată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Comenzi livrate recent</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Nr. Comandă</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Agent</TableCell>
              <TableCell>Șofer</TableCell>
              <TableCell>Mașină</TableCell>
              <TableCell>Creat</TableCell>
              <TableCell>Livrat</TableCell>
              <TableCell align="right">Durată</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.slice(0, 100).map((o, i) => {
              const dur = o.created_at && o.delivered_at
                ? new Date(o.delivered_at as string).getTime() - new Date(o.created_at as string).getTime()
                : 0;
              return (
                <TableRow key={i}>
                  <TableCell><strong>{String(o.number || '-')}</strong></TableCell>
                  <TableCell>{String(o.partner_name || o.customer_name || '-')}</TableCell>
                  <TableCell>{String(o.agent_name || '-')}</TableCell>
                  <TableCell>{String(o.driver_name || '-')}</TableCell>
                  <TableCell>{String(o.vehicle_number || '-')}</TableCell>
                  <TableCell>{fmtDate(o.created_at as string)}</TableCell>
                  <TableCell>{fmtDate(o.delivered_at as string)}</TableCell>
                  <TableCell align="right">
                    {dur > 0 ? <Chip label={fmtDays(dur)} size="small" color="success" /> : '-'}
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

// ─── Tab: KPI General ─────────────────────────────────────────────────────────

function KPIGeneralTab() {
  type Job = Record<string, unknown>;
  type Order = Record<string, unknown>;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rj, ro] = await Promise.allSettled([
        authClient().get('/pick-jobs', { params: { limit: 1000 } }),
        authClient().get('/orders', { params: { limit: 500 } }),
      ]);
      let jobData: Job[] = rj.status === 'fulfilled'
        ? (Array.isArray(rj.value.data?.data) ? rj.value.data.data : Array.isArray(rj.value.data) ? rj.value.data : [])
        : [];
      let orderData: Order[] = ro.status === 'fulfilled'
        ? (Array.isArray(ro.value.data?.data) ? ro.value.data.data : Array.isArray(ro.value.data) ? ro.value.data : [])
        : [];
      if (rj.status === 'rejected') setError((rj.reason as Error)?.message || 'Eroare pick-jobs');
      if (dateFrom || dateTo) {
        jobData = jobData.filter((j) => {
          const d = j.completed_at ?? j.created_at;
          if (!d) return false;
          const dt = new Date(d as string);
          if (dateFrom && dt < new Date(dateFrom)) return false;
          if (dateTo && dt > new Date(dateTo + 'T23:59:59')) return false;
          return true;
        });
        orderData = orderData.filter((o) => {
          const d = o.created_at;
          if (!d) return false;
          const dt = new Date(d as string);
          if (dateFrom && dt < new Date(dateFrom)) return false;
          if (dateTo && dt > new Date(dateTo + 'T23:59:59')) return false;
          return true;
        });
      }
      setJobs(jobData);
      setOrders(orderData);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare');
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // KPI: picking jobs
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');
  const cancelledJobs = jobs.filter(j => j.status === 'CANCELLED');
  const pickingTimes = completedJobs
    .filter(j => j.started_at && j.completed_at)
    .map(j => new Date(j.completed_at as string).getTime() - new Date(j.started_at as string).getTime())
    .filter(ms => ms > 0);
  const avgPickingMs = pickingTimes.length > 0 ? pickingTimes.reduce((a, b) => a + b, 0) / pickingTimes.length : 0;

  // KPI: orders
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
  const deliveryTimes = deliveredOrders
    .filter(o => o.created_at && o.delivered_at)
    .map(o => new Date(o.delivered_at as string).getTime() - new Date(o.created_at as string).getTime())
    .filter(ms => ms > 0);
  const avgDeliveryMs = deliveryTimes.length > 0 ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length : 0;

  // KPI: comenzi per lucrător
  const byWorker: Record<string, { jobs: number; completed: number; cancelled: number }> = {};
  for (const j of jobs) {
    const op = String(j.assigned_to || 'Nealocat');
    if (!byWorker[op]) byWorker[op] = { jobs: 0, completed: 0, cancelled: 0 };
    byWorker[op].jobs++;
    if (j.status === 'COMPLETED') byWorker[op].completed++;
    if (j.status === 'CANCELLED') byWorker[op].cancelled++;
  }
  const workers = Object.entries(byWorker).sort((a, b) => b[1].jobs - a[1].jobs);
  const avgJobsPerWorker = workers.length > 0 ? Math.round(jobs.length / workers.length) : 0;

  // Error rate: cancelled / total
  const errorRate = jobs.length > 0 ? Math.round(cancelledJobs.length / jobs.length * 100) : 0;

  function fmtDays(ms: number) {
    if (!ms || ms <= 0) return '-';
    const h = Math.round(ms / 3600000);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}z ${h % 24}h`;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <TextField label="De la" type="date" size="small" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField label="Până la" type="date" size="small" value={dateTo} onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI Cards — row 1: picking */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Picking & Operatori</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
        <Card sx={{ minWidth: 180 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Total joburi picking</Typography>
          <Typography variant="h5">{jobs.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: 'success.50' }}><CardContent>
          <Typography variant="caption" color="success.main" fontWeight={700}>Finalizate</Typography>
          <Typography variant="h5" color="success.main">{completedJobs.length}</Typography>
          <Typography variant="caption" color="text.secondary">
            {jobs.length > 0 ? Math.round(completedJobs.length / jobs.length * 100) : 0}%
          </Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 200, bgcolor: 'primary.50' }}><CardContent>
          <Typography variant="caption" color="primary.main" fontWeight={700}>Timp mediu picking</Typography>
          <Typography variant="h5" color="primary.main">{fmtMin(avgPickingMs)}</Typography>
          <Typography variant="caption" color="text.secondary">din {pickingTimes.length} joburi măsurate</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Joburi per lucrător (avg)</Typography>
          <Typography variant="h5">{avgJobsPerWorker}</Typography>
          <Typography variant="caption" color="text.secondary">{workers.length} lucrători activi</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160, bgcolor: errorRate > 10 ? 'error.50' : 'inherit' }}><CardContent>
          <Typography variant="caption" color={errorRate > 10 ? 'error.main' : 'text.secondary'} fontWeight={errorRate > 10 ? 700 : 400}>
            Erori / anulate
          </Typography>
          <Typography variant="h5" color={errorRate > 10 ? 'error.main' : 'inherit'}>
            {cancelledJobs.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">rata: {errorRate}%</Typography>
        </CardContent></Card>
      </Stack>

      {/* KPI Cards — row 2: livrare */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, mt: 1 }}>Livrare & Comenzi</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Card sx={{ minWidth: 160 }}><CardContent>
          <Typography variant="caption" color="text.secondary">Total comenzi</Typography>
          <Typography variant="h5">{orders.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 180, bgcolor: 'success.50' }}><CardContent>
          <Typography variant="caption" color="success.main" fontWeight={700}>Livrate</Typography>
          <Typography variant="h5" color="success.main">{deliveredOrders.length}</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 220, bgcolor: 'primary.50' }}><CardContent>
          <Typography variant="caption" color="primary.main" fontWeight={700}>Timp mediu livrare</Typography>
          <Typography variant="h5" color="primary.main">{fmtDays(avgDeliveryMs)}</Typography>
          <Typography variant="caption" color="text.secondary">din {deliveryTimes.length} comenzi măsurate</Typography>
        </CardContent></Card>
        <Card sx={{ minWidth: 160, bgcolor: cancelledOrders.length > 0 ? 'error.50' : 'inherit' }}><CardContent>
          <Typography variant="caption" color={cancelledOrders.length > 0 ? 'error.main' : 'text.secondary'} fontWeight={cancelledOrders.length > 0 ? 700 : 400}>
            Comenzi anulate
          </Typography>
          <Typography variant="h5" color={cancelledOrders.length > 0 ? 'error.main' : 'inherit'}>
            {cancelledOrders.length}
          </Typography>
        </CardContent></Card>
      </Stack>

      {/* Comenzi per lucrător */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Joburi per lucrător</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Lucrător</TableCell>
              <TableCell align="right">Total joburi</TableCell>
              <TableCell align="right">Finalizate</TableCell>
              <TableCell align="right">Anulate (erori)</TableCell>
              <TableCell align="right">Rată succes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workers.map(([op, v]) => {
              const rate = v.jobs > 0 ? Math.round(v.completed / v.jobs * 100) : 0;
              return (
                <TableRow key={op}>
                  <TableCell><strong>{op}</strong></TableCell>
                  <TableCell align="right">{v.jobs}</TableCell>
                  <TableCell align="right"><Typography color="success.main">{v.completed}</Typography></TableCell>
                  <TableCell align="right">
                    {v.cancelled > 0
                      ? <Typography color="error.main" fontWeight={700}>{v.cancelled}</Typography>
                      : <Typography color="text.disabled">0</Typography>
                    }
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={rate} sx={{ width: 60, height: 6, borderRadius: 3 }}
                        color={rate > 80 ? 'success' : rate > 60 ? 'warning' : 'error'} />
                      <Typography variant="caption" fontWeight={700}>{rate}%</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {workers.length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.disabled' }}>Nicio dată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

const TABS = [
  { label: 'KPI General', component: <KPIGeneralTab /> },
  { label: 'Performanță Picking', component: <PickingPerfTab /> },
  { label: 'Performanță Livrare', component: <LivrarePerformantaTab /> },
];

export default function PerformancePage() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <SpeedIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Rapoarte Performanță</Typography>
          <Typography variant="body2" color="text.secondary">
            KPI general, timp mediu picking/livrare, productivitate operatori și erori
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
