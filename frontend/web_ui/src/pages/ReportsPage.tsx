import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stack, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, Chip, CircularProgress, TextField, Divider, Alert,
  LinearProgress, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BarChartIcon from '@mui/icons-material/BarChart';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import HistoryIcon from '@mui/icons-material/History';
import { warehouseConfigService } from '../services/warehouseConfig.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtNum(n: number | string | null | undefined, decimals = 1) {
  if (n == null) return '-';
  return Number(n).toFixed(decimals);
}

function StrategyChip({ strategy }: { strategy: string }) {
  const colorMap: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
    MIN_WASTE: 'success',
    MINIMIZE_WASTE: 'success',
    USE_REMAINS_FIRST: 'warning',
    FIFO: 'info',
    FEWEST_CUTS: 'default',
    NONE: 'default',
  };
  return <Chip label={strategy} color={colorMap[strategy] || 'default'} size="small" />;
}

// ─── Tab 1: Eficiență Picking ─────────────────────────────────────────────────

function PickingEfficiencyTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await warehouseConfigService.reportPickingEfficiency({
        from: from || undefined,
        to: to || undefined,
      });
      setData(res?.data || res);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary as Record<string, unknown> | undefined;
  const byStrategy = (data?.by_strategy as unknown[]) || [];
  const byRule = (data?.by_rule as unknown[]) || [];
  const total = Number(summary?.total_items || 0);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField label="De la" type="date" size="small" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Până la" type="date" size="small" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">Total joburi</Typography>
            <Typography variant="h5">{summary.total_jobs as string}</Typography>
          </CardContent></Card>
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">Total articole</Typography>
            <Typography variant="h5">{summary.total_items as string}</Typography>
          </CardContent></Card>
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">Cu regulă aplicată</Typography>
            <Typography variant="h5" color="success.main">{summary.items_with_rule as string}</Typography>
          </CardContent></Card>
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">Fără regulă</Typography>
            <Typography variant="h5" color="text.secondary">{summary.items_no_rule as string}</Typography>
          </CardContent></Card>
        </Stack>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Distribuție pe strategie</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Strategie</TableCell>
                  <TableCell align="right">Articole</TableCell>
                  <TableCell align="right">Joburi</TableCell>
                  <TableCell>%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byStrategy.map((row: unknown) => {
                  const r = row as Record<string, unknown>;
                  const pct = total > 0 ? Math.round(Number(r.item_count) / total * 100) : 0;
                  return (
                    <TableRow key={String(r.strategy)}>
                      <TableCell><StrategyChip strategy={String(r.strategy)} /></TableCell>
                      <TableCell align="right">{String(r.item_count)}</TableCell>
                      <TableCell align="right">{String(r.job_count)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={pct} sx={{ width: 60, height: 6, borderRadius: 3 }} />
                          <Typography variant="caption">{pct}%</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {byStrategy.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={4} align="center">Nicio dată</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 10 reguli aplicate</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Regulă</TableCell>
                  <TableCell align="right">Articole</TableCell>
                  <TableCell align="right">Joburi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byRule.map((row: unknown, i: number) => {
                  const r = row as Record<string, unknown>;
                  return (
                    <TableRow key={i}>
                      <TableCell>{String(r.rule_name)}</TableCell>
                      <TableCell align="right">{String(r.count)}</TableCell>
                      <TableCell align="right">{String(r.jobs)}</TableCell>
                    </TableRow>
                  );
                })}
                {byRule.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={3} align="center">Nicio dată</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Stack>
    </Box>
  );
}

// ─── Tab 2: Locații sub-utilizate ────────────────────────────────────────────

function UnderusedLocationsTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState('30');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await warehouseConfigService.reportUnderusedLocations({ days: parseInt(days) || 30 });
      setData(res?.data || res);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const locations = (data?.locations as unknown[]) || [];

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Zile inactivitate"
          type="number"
          size="small"
          value={days}
          onChange={e => setDays(e.target.value)}
          inputProps={{ min: 1, max: 365 }}
          sx={{ width: 160 }}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {locations.length} locații fără activitate în ultimele {days} zile
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cod locație</TableCell>
              <TableCell>Zonă</TableCell>
              <TableCell>Depozit</TableCell>
              <TableCell align="right">Zile inactive</TableCell>
              <TableCell>Ultima mișcare</TableCell>
              <TableCell align="right">Ocupare %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.map((row: unknown, i: number) => {
              const r = row as Record<string, unknown>;
              const daysInactive = Math.round(Number(r.days_inactive || 0));
              return (
                <TableRow key={i} sx={{ bgcolor: daysInactive > 90 ? '#fff7ed' : 'inherit' }}>
                  <TableCell><strong>{String(r.location_code || '-')}</strong></TableCell>
                  <TableCell>{String(r.zone_code || '-')}</TableCell>
                  <TableCell>{String(r.warehouse_name || '-')}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${daysInactive}z`}
                      color={daysInactive > 90 ? 'error' : daysInactive > 60 ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{fmtDate(r.last_movement_at as string)}</TableCell>
                  <TableCell align="right">{fmtNum(r.current_occupancy_percent)}%</TableCell>
                </TableRow>
              );
            })}
            {locations.length === 0 && !loading && (
              <TableRow><TableCell colSpan={6} align="center">Nicio locație sub-utilizată</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab 3: Resturi mari ──────────────────────────────────────────────────────

function LargeRemnantsTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [minMeters, setMinMeters] = useState('10');
  const [inactiveDays, setInactiveDays] = useState('14');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await warehouseConfigService.reportLargeRemnants({
        min_meters: parseFloat(minMeters) || 10,
        inactive_days: parseInt(inactiveDays) || 14,
      });
      setData(res?.data || res);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, [minMeters, inactiveDays]);

  useEffect(() => { load(); }, [load]);

  const remnants = (data?.remnants as unknown[]) || [];
  const summary = data?.summary as Record<string, unknown> | undefined;

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Rest minim (m)"
          type="number"
          size="small"
          value={minMeters}
          onChange={e => setMinMeters(e.target.value)}
          sx={{ width: 140 }}
        />
        <TextField
          label="Zile inactive"
          type="number"
          size="small"
          value={inactiveDays}
          onChange={e => setInactiveDays(e.target.value)}
          sx={{ width: 140 }}
        />
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">Loturi cu rest</Typography>
            <Typography variant="h5">{String(summary.batch_count)}</Typography>
          </CardContent></Card>
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">Total rest (m)</Typography>
            <Typography variant="h5" color="warning.main">{fmtNum(summary.total_remaining_m as number)}m</Typography>
          </CardContent></Card>
          <Card sx={{ minWidth: 160 }}><CardContent>
            <Typography variant="caption" color="text.secondary">SKU-uri distincte</Typography>
            <Typography variant="h5">{String(summary.distinct_skus)}</Typography>
          </CardContent></Card>
        </Stack>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Lot</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Rest (m)</TableCell>
              <TableCell align="right">Initial (m)</TableCell>
              <TableCell align="right">% rămas</TableCell>
              <TableCell>Locație</TableCell>
              <TableCell>Vârstă (zile)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {remnants.map((row: unknown, i: number) => {
              const r = row as Record<string, unknown>;
              const pct = Number(r.percent_remaining);
              return (
                <TableRow key={i}>
                  <TableCell><strong>{String(r.batch_number || '-')}</strong></TableCell>
                  <TableCell>{String(r.product_sku || '-')}</TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} color="warning.main">
                      {fmtNum(r.remaining_m as number)}m
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{fmtNum(r.initial_m as number)}m</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={pct < 10 ? 'error' : 'warning'}
                        sx={{ width: 50, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption">{fmtNum(pct)}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{r.zone_code ? `${r.zone_code} / ` : ''}{String(r.location_code || '-')}</TableCell>
                  <TableCell>
                    <Chip label={`${Math.round(Number(r.age_days))}z`} size="small" color={Number(r.age_days) > 60 ? 'error' : 'default'} />
                  </TableCell>
                </TableRow>
              );
            })}
            {remnants.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} align="center">Niciun rest găsit cu filtrele curente</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab 4: Audit Log ─────────────────────────────────────────────────────────

function AuditLogTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [opType, setOpType] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await warehouseConfigService.listAuditLog({
        operation_type: opType || undefined,
        limit: 100,
      });
      setData(res);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, [opType]);

  useEffect(() => { load(); }, [load]);

  const logs = (data?.data as unknown[]) || [];
  const pagination = data?.pagination as Record<string, unknown> | undefined;

  const opTypes = ['', 'PUTAWAY', 'PICKING', 'CUTTING', 'EVALUATE'];

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1}>
          {opTypes.map(op => (
            <Chip
              key={op || 'ALL'}
              label={op || 'TOATE'}
              onClick={() => setOpType(op)}
              color={opType === op ? 'primary' : 'default'}
              variant={opType === op ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Reîncarcă</Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {pagination?.total as number || logs.length} înregistrări
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Timp</TableCell>
              <TableCell>Operațiune</TableCell>
              <TableCell>Regulă aplicată</TableCell>
              <TableCell>Acțiune</TableCell>
              <TableCell>Valoare</TableCell>
              <TableCell>Entitate</TableCell>
              <TableCell align="center">Blocat</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((row: unknown, i: number) => {
              const r = row as Record<string, unknown>;
              return (
                <TableRow key={i} sx={{ bgcolor: r.blocked ? '#fff7ed' : 'inherit' }}>
                  <TableCell>
                    <Tooltip title={String(r.created_at || '')}>
                      <Typography variant="caption">
                        {new Date(r.created_at as string).toLocaleString('ro-RO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip label={String(r.operation_type || '-')} size="small"
                      color={r.operation_type === 'PICKING' ? 'info' : r.operation_type === 'PUTAWAY' ? 'success' : r.operation_type === 'CUTTING' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>{String(r.rule_name || '-')}</TableCell>
                  <TableCell><code>{String(r.action_type || '-')}</code></TableCell>
                  <TableCell>{String(r.action_value || '-')}</TableCell>
                  <TableCell>
                    {r.entity_type && <><Typography variant="caption" color="text.secondary">{String(r.entity_type)}</Typography><br /></>}
                    <Typography variant="caption">{String(r.entity_id || '-')}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    {r.blocked ? <Chip label="BLOCAT" color="error" size="small" /> : <Typography variant="caption" color="text.secondary">—</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
            {logs.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} align="center">Nicio înregistrare</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Pagina principală ────────────────────────────────────────────────────────

export function ReportsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Rapoarte WMS</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab icon={<BarChartIcon />} iconPosition="start" label="Eficiență Picking" />
        <Tab icon={<LocationOffIcon />} iconPosition="start" label="Locații Sub-utilizate" />
        <Tab icon={<ContentCutIcon />} iconPosition="start" label="Resturi Mari" />
        <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit Log Reguli" />
      </Tabs>

      {tab === 0 && <PickingEfficiencyTab />}
      {tab === 1 && <UnderusedLocationsTab />}
      {tab === 2 && <LargeRemnantsTab />}
      {tab === 3 && <AuditLogTab />}
    </Box>
  );
}

export default ReportsPage;

