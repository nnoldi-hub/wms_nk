/**
 * ActivityLogPage.tsx — Faza 6.1: Audit Log General
 *
 * Vizualizator complet al log-ului de audit al motorului de reguli WMS.
 * Sursa: GET /api/v1/rules/audit-log + /api/v1/rules/audit-log/stats
 *
 * Features:
 *  - Statistici sumar (total, blocked, pe tip operatie)
 *  - Filtre: operation_type, entity_type, blocked, interval date
 *  - Tabel paginat cu search
 *  - Export CSV
 *  - Drawer cu detalii complet per intrare (context_snapshot JSONB)
 */

import { useState, useEffect, useCallback } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box, Typography, Paper, Button, Stack, CircularProgress,
  Chip, Divider, IconButton, Tooltip, Drawer, TextField,
  FormControl, InputLabel, Select, MenuItem, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, TablePagination,
  Card, CardContent, Tab, Tabs,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ───────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  operation_type: string;       // PUTAWAY | PICKING | CUTTING | EVALUATE
  entity_type: string | null;
  entity_id: string | null;
  rule_id: string | null;
  rule_name: string | null;
  rule_name_current: string | null;
  rule_scope: string | null;
  rule_type: string | null;
  action_type: string | null;
  action_value: string | null;
  context_snapshot: Record<string, unknown> | null;
  matched: boolean;
  blocked: boolean;
  triggered_by: string | null;
  triggered_by_name: string | null;
  created_at: string;
}

interface AuditStats {
  total: number;
  blocked_count: number;
  by_operation: { operation_type: string; count: string }[];
  recent_24h: number;
  top_rules: { rule_name: string; count: string }[];
}

interface Filters {
  operation_type: string;
  entity_type: string;
  blocked: string;
  from: string;
  to: string;
}

interface OpsEntry {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_code: string | null;
  service: string | null;
  changes: Record<string, unknown> | null;
  extra_info: Record<string, unknown> | null;
  user_id: string | null;
  user_name: string | null;
  ip_address: string | null;
  created_at: string;
}

interface OpsFilters {
  action_type: string;
  entity_type: string;
  service: string;
  from: string;
  to: string;
  q: string;
}

// ─── Constante UI ─────────────────────────────────────────────────────────────

const OP_COLOR: Record<string, 'primary' | 'secondary' | 'warning' | 'info'> = {
  PUTAWAY: 'primary',
  PICKING: 'secondary',
  CUTTING: 'warning',
  EVALUATE: 'info',
};

const ENTITY_LABELS: Record<string, string> = {
  picking_job: 'Picking Job',
  location: 'Locatie',
  cutting_order: 'Ordin Taiere',
};

// ─── Helper formatare ─────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function actionColor(a: string): 'success' | 'info' | 'error' | 'primary' | 'secondary' | 'default' {
  if (a.startsWith('CREATE_')) return 'success';
  if (a.startsWith('UPDATE_') || a.startsWith('PATCH_')) return 'info';
  if (a.startsWith('DELETE_')) return 'error';
  if (a === 'RECEIPT_BATCH') return 'primary';
  if (a === 'PICKING_COMPLETE') return 'secondary';
  return 'default';
}

function exportCSV(rows: AuditEntry[]) {
  const headers = ['Timestamp', 'Operatie', 'Entitate', 'ID Entitate', 'Regula', 'Tip Actiune', 'Valoare', 'Blocat', 'Utilizator'];
  const lines = rows.map(r => [
    fmtDate(r.created_at),
    r.operation_type,
    r.entity_type || '',
    r.entity_id || '',
    r.rule_name || r.rule_name_current || '',
    r.action_type || '',
    r.action_value || '',
    r.blocked ? 'DA' : 'NU',
    r.triggered_by_name || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon && <Box sx={{ color: color || 'text.secondary' }}>{icon}</Box>}
          <Box>
            <Typography variant="h5" fontWeight="bold" sx={{ color: color || 'text.primary', lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Pagina principala ────────────────────────────────────────────────────────
// ─── OpsAuditTab ─────────────────────────────────────────────────────────────

function OpsAuditTab({ defaultService = '' }: { defaultService?: string }) {
  const [entries, setEntries] = useState<OpsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selected, setSelected] = useState<OpsEntry | null>(null);
  const [opsStats, setOpsStats] = useState<{ by_action: { action_type: string; cnt: number }[]; by_service: { service: string; cnt: number }[] } | null>(null);
  const [filters, setFilters] = useState<OpsFilters>({
    action_type: '', entity_type: '', service: defaultService, from: '', to: '', q: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: rowsPerPage, offset: page * rowsPerPage };
      if (filters.action_type) params.action_type = filters.action_type;
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.service) params.service = filters.service;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.q) params.q = filters.q;
      const [res, statsRes] = await Promise.all([
        warehouseConfigService.getOpsAudit(params),
        warehouseConfigService.getOpsAuditStats(),
      ]);
      setEntries(res.data || []);
      setTotal(res.pagination?.total || 0);
      if (statsRes.data) setOpsStats(statsRes.data);
    } catch {
      // eroare silentioasa
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFilter = (key: keyof OpsFilters, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(0);
  };

  return (
    <Box>
      {/* Stats rapide */}
      {opsStats && opsStats.by_action.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {opsStats.by_action.slice(0, 6).map(a => (
            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={a.action_type}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                  <Chip label={a.action_type.replace(/_/g, ' ')} size="small" color={actionColor(a.action_type)} sx={{ mb: 0.5, maxWidth: '100%' }} />
                  <Typography variant="h6" fontWeight="bold">{a.cnt.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filtre */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FilterListIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight="medium">Filtre</Typography>
          <Box flexGrow={1} />
          <Button size="small" onClick={() => { setFilters({ action_type: '', entity_type: '', service: '', from: '', to: '', q: '' }); setPage(0); }}>Resetează</Button>
        </Stack>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Acțiune</InputLabel>
              <Select value={filters.action_type} label="Acțiune" onChange={e => handleFilter('action_type', e.target.value)}>
                <MenuItem value="">— Toate —</MenuItem>
                {/* Locații */}
                <MenuItem value="CREATE_LOCATION">CREATE_LOCATION</MenuItem>
                <MenuItem value="UPDATE_LOCATION">UPDATE_LOCATION</MenuItem>
                <MenuItem value="DELETE_LOCATION">DELETE_LOCATION</MenuItem>
                <MenuItem value="PATCH_CAPACITY">PATCH_CAPACITY</MenuItem>
                <MenuItem value="PATCH_COORDINATES">PATCH_COORDINATES</MenuItem>
                {/* Lots & Picking */}
                <MenuItem value="RECEIPT_BATCH">RECEIPT_BATCH</MenuItem>
                <MenuItem value="PICKING_COMPLETE">PICKING_COMPLETE</MenuItem>
                {/* Setări depozit (6.1) */}
                <MenuItem value="SETTING_CREATE">SETTING_CREATE</MenuItem>
                <MenuItem value="SETTING_UPDATE">SETTING_UPDATE</MenuItem>
                <MenuItem value="SETTING_DELETE">SETTING_DELETE</MenuItem>
                {/* Acțiuni UI (6.3) */}
                <MenuItem value="PAGE_VIEW">PAGE_VIEW</MenuItem>
                <MenuItem value="EXPORT_CSV">EXPORT_CSV</MenuItem>
                <MenuItem value="IMPORT_CSV">IMPORT_CSV</MenuItem>
                <MenuItem value="BUTTON_CLICK">BUTTON_CLICK</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Entitate</InputLabel>
              <Select value={filters.entity_type} label="Entitate" onChange={e => handleFilter('entity_type', e.target.value)}>
                <MenuItem value="">— Toate —</MenuItem>
                <MenuItem value="location">Locatie</MenuItem>
                <MenuItem value="batch">Lot</MenuItem>
                <MenuItem value="picking_job">Picking Job</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Serviciu</InputLabel>
              <Select value={filters.service} label="Serviciu" onChange={e => handleFilter('service', e.target.value)}>
                <MenuItem value="">— Toate —</MenuItem>
                <MenuItem value="warehouse-config">warehouse-config</MenuItem>
                <MenuItem value="inventory">inventory</MenuItem>              <MenuItem value="ui">UI (browser)</MenuItem>              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField fullWidth size="small" label="Caută cod" value={filters.q} onChange={e => handleFilter('q', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="De la" InputLabelProps={{ shrink: true }} value={filters.from} onChange={e => handleFilter('from', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Până la" InputLabelProps={{ shrink: true }} value={filters.to} onChange={e => handleFilter('to', e.target.value)} />
          </Grid>
        </Grid>
      </Paper>

      {/* Tabel */}
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>Timestamp</TableCell>
                <TableCell sx={{ width: 190 }}>Acțiune</TableCell>
                <TableCell>Entitate / Cod</TableCell>
                <TableCell sx={{ width: 140 }}>Serviciu</TableCell>
                <TableCell sx={{ width: 130 }}>Utilizator</TableCell>
                <TableCell sx={{ width: 48 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">Niciun eveniment găsit.</Typography></TableCell></TableRow>
              ) : entries.map(row => (
                <TableRow key={row.id} hover sx={{ opacity: loading ? 0.6 : 1 }}>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{fmtDate(row.created_at)}</Typography></TableCell>
                  <TableCell><Chip label={row.action_type.replace(/_/g, ' ')} size="small" color={actionColor(row.action_type)} /></TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.entity_type}</Typography>
                    {row.entity_code && <Typography variant="caption" color="text.disabled" fontFamily="monospace">{row.entity_code}</Typography>}
                  </TableCell>
                  <TableCell><Chip label={row.service || '—'} size="small" variant="outlined" /></TableCell>
                  <TableCell><Typography variant="caption">{row.user_name || '—'}</Typography></TableCell>
                  <TableCell>
                    <Tooltip title="Detalii"><IconButton size="small" onClick={() => setSelected(row)}><InfoOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider />
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100, 200]}
          labelRowsPerPage="Rânduri per pagină:"
          labelDisplayedRows={({ from: f, to: t, count: c }) => `${f}–${t} din ${c}`}
        />
      </Paper>

      {/* Drawer detalii operațiune */}
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 440, p: 3 } }}>
        {selected && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Detalii Operațiune</Typography>
              <IconButton onClick={() => setSelected(null)}><CloseIcon /></IconButton>
            </Stack>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">ID</Typography>
                <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', fontSize: '0.72rem' }}>{selected.id}</Typography>
              </Paper>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Acțiune</Typography>
                  <Box><Chip label={selected.action_type.replace(/_/g, ' ')} size="small" color={actionColor(selected.action_type)} /></Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Entitate</Typography>
                  <Typography variant="body2">{selected.entity_type}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Cod</Typography>
                  <Typography variant="body2" fontFamily="monospace">{selected.entity_code || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">ID entitate</Typography>
                  <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{selected.entity_id || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Serviciu</Typography>
                  <Typography variant="body2">{selected.service || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2">{fmtDate(selected.created_at)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Utilizator</Typography>
                  <Typography variant="body2">{selected.user_name || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">IP</Typography>
                  <Typography variant="body2" fontFamily="monospace">{selected.ip_address || '—'}</Typography>
                </Grid>
              </Grid>
              {selected.changes && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Modificări:</Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.900', borderRadius: 1, maxHeight: 220, overflowY: 'auto' }}>
                      <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'grey.100' }}>
                        {JSON.stringify(selected.changes, null, 2)}
                      </Typography>
                    </Paper>
                  </Box>
                </>
              )}
              {selected.extra_info && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Info extra:</Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.900', borderRadius: 1, maxHeight: 180, overflowY: 'auto' }}>
                      <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'grey.100' }}>
                        {JSON.stringify(selected.extra_info, null, 2)}
                      </Typography>
                    </Paper>
                  </Box>
                </>
              )}
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

// ─── Pagina principala ────────────────────────────────────────────────────────
export default function ActivityLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [filters, setFilters] = useState<Filters>({
    operation_type: '',
    entity_type: '',
    blocked: '',
    from: '',
    to: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };
      if (filters.operation_type) params.operation_type = filters.operation_type;
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.blocked !== '') params.blocked = filters.blocked;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const [logRes, statsRes] = await Promise.all([
        warehouseConfigService.getAuditLog(params),
        warehouseConfigService.getAuditStats({ from: filters.from, to: filters.to }),
      ]);

      setEntries(logRes.data || []);
      setTotal(logRes.pagination?.total || 0);
      if (statsRes.data) setStats(statsRes.data);
    } catch {
      // eroare silentioasa — afisam datele vechi
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleReset = () => {
    setFilters({ operation_type: '', entity_type: '', blocked: '', from: '', to: '' });
    setPage(0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Audit Log WMS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Istoric complet al deciziilor motorului de reguli — putaway, picking, tăiere, evaluare.
            Fiecare operațiune este înregistrată cu regula aplicată, acțiunea generată și utilizatorul.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Export CSV">
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => exportCSV(entries)}
              disabled={entries.length === 0}
            >
              Export CSV
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={fetchData}
            disabled={loading || activeTab !== 0}
          >
            Reîncarcă
          </Button>
        </Stack>
      </Stack>

      {/* Notă informativă pentru tabul UI */}
      {activeTab === 2 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Acțiunile înregistrate din interfața web — navigare, exporturi, import CSV, click-uri cheie.
          Logarea se face automat la acțiunile principale ale utilizatorilor.
        </Typography>
      )}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Reguli (Motor Decizii)" />
        <Tab label="Operațiuni WMS" />
        <Tab label="Acțiuni UI" />
      </Tabs>

      {activeTab === 2 && <OpsAuditTab defaultService="ui" />}
      {activeTab === 1 && <OpsAuditTab />}
      {activeTab === 0 && <>
      {/* KPI Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Total evenimente" value={stats.total.toLocaleString()} icon={<HistoryIcon />} color="text.primary" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Blocate (override necesar)" value={stats.blocked_count} icon={<BlockIcon />} color="error.main" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Ultimele 24h" value={stats.recent_24h} icon={<CheckCircleIcon />} color="success.main" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard
              label="Regula cea mai frecventa"
              value={stats.top_rules[0]?.rule_name?.split(' ').slice(0, 3).join(' ') || '—'}
              icon={<AssignmentLateIcon />}
              color="primary.main"
            />
          </Grid>
          {/* Per-operatie */}
          {stats.by_operation.map(op => (
            <Grid size={{ xs: 6, sm: 3 }} key={op.operation_type}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                  <Chip
                    label={op.operation_type}
                    size="small"
                    color={OP_COLOR[op.operation_type] || 'default'}
                    sx={{ mb: 0.5 }}
                  />
                  <Typography variant="h6" fontWeight="bold">{Number(op.count).toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filtre */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FilterListIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight="medium">Filtre</Typography>
          <Box flexGrow={1} />
          <Button size="small" onClick={handleReset}>Resetează</Button>
        </Stack>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Operație</InputLabel>
              <Select value={filters.operation_type} label="Operație" onChange={e => handleFilterChange('operation_type', e.target.value)}>
                <MenuItem value="">— Toate —</MenuItem>
                <MenuItem value="PUTAWAY">PUTAWAY</MenuItem>
                <MenuItem value="PICKING">PICKING</MenuItem>
                <MenuItem value="CUTTING">CUTTING</MenuItem>
                <MenuItem value="EVALUATE">EVALUATE</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tip entitate</InputLabel>
              <Select value={filters.entity_type} label="Tip entitate" onChange={e => handleFilterChange('entity_type', e.target.value)}>
                <MenuItem value="">— Toate —</MenuItem>
                <MenuItem value="picking_job">Picking Job</MenuItem>
                <MenuItem value="location">Locatie</MenuItem>
                <MenuItem value="cutting_order">Ordin Taiere</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Blocat</InputLabel>
              <Select value={filters.blocked} label="Blocat" onChange={e => handleFilterChange('blocked', e.target.value)}>
                <MenuItem value="">— Toate —</MenuItem>
                <MenuItem value="true">Blocat (DA)</MenuItem>
                <MenuItem value="false">Permis (NU)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth size="small" type="date" label="De la"
              InputLabelProps={{ shrink: true }}
              value={filters.from}
              onChange={e => handleFilterChange('from', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth size="small" type="date" label="Până la"
              InputLabelProps={{ shrink: true }}
              value={filters.to}
              onChange={e => handleFilterChange('to', e.target.value)}
            />
          </Grid>
        </Grid>
        {/* Top rules */}
        {stats?.top_rules && stats.top_rules.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Top reguli:</Typography>
            {stats.top_rules.map(r => (
              <Chip
                key={r.rule_name}
                label={`${r.rule_name} (${r.count})`}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
                onClick={() => {/* future: filter by rule */}}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Tabel */}
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 160 }}>Timestamp</TableCell>
                <TableCell sx={{ width: 110 }}>Operație</TableCell>
                <TableCell sx={{ width: 120 }}>Entitate</TableCell>
                <TableCell>Regulă aplicată</TableCell>
                <TableCell>Acțiune generată</TableCell>
                <TableCell sx={{ width: 90 }}>Rezultat</TableCell>
                <TableCell sx={{ width: 110 }}>Utilizator</TableCell>
                <TableCell sx={{ width: 48 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Niciun eveniment găsit cu filtrele curente.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(row => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ bgcolor: row.blocked ? 'error.dark' : 'transparent', opacity: loading ? 0.6 : 1 }}
                  >
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">
                        {fmtDate(row.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.operation_type}
                        size="small"
                        color={OP_COLOR[row.operation_type] || 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ENTITY_LABELS[row.entity_type || ''] || row.entity_type || '—'}
                      </Typography>
                      {row.entity_id && (
                        <Typography variant="caption" color="text.disabled" fontFamily="monospace">
                          {row.entity_id.slice(0, 8)}…
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.rule_name || row.rule_name_current
                        ? (
                          <Stack spacing={0.25}>
                            <Typography variant="body2">{row.rule_name || row.rule_name_current}</Typography>
                            {row.rule_scope && <Chip label={row.rule_scope} size="small" variant="outlined" sx={{ width: 'fit-content', height: 16, fontSize: '0.6rem' }} />}
                          </Stack>
                        )
                        : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>
                      {row.action_type ? (
                        <Typography variant="body2">
                          <strong>{row.action_type}</strong>{row.action_value ? `: ${row.action_value}` : ''}
                        </Typography>
                      ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>
                      {row.blocked
                        ? <Chip icon={<BlockIcon />} label="Blocat" size="small" color="error" />
                        : <Chip icon={<CheckCircleIcon />} label="OK" size="small" color="success" variant="outlined" />
                      }
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{row.triggered_by_name || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Detalii complete">
                        <IconButton size="small" onClick={() => setSelectedEntry(row)}>
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider />
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100, 200]}
          labelRowsPerPage="Rânduri per pagină:"
          labelDisplayedRows={({ from: f, to: t, count: c }) => `${f}–${t} din ${c}`}
        />
      </Paper>

      {/* Drawer detalii */}
      <Drawer
        anchor="right"
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        {selectedEntry && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Detalii Eveniment</Typography>
              <IconButton onClick={() => setSelectedEntry(null)}><CloseIcon /></IconButton>
            </Stack>

            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">ID</Typography>
                <Typography variant="body2" fontFamily="monospace">{selectedEntry.id}</Typography>
              </Paper>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Operație</Typography>
                  <Box><Chip label={selectedEntry.operation_type} size="small" color={OP_COLOR[selectedEntry.operation_type] || 'default'} /></Box>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2">{fmtDate(selectedEntry.created_at)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Entitate</Typography>
                  <Typography variant="body2">{selectedEntry.entity_type || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">ID Entitate</Typography>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', fontSize: '0.7rem' }}>{selectedEntry.entity_id || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Regulă</Typography>
                  <Typography variant="body2">{selectedEntry.rule_name || selectedEntry.rule_name_current || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Scope regulă</Typography>
                  <Typography variant="body2">{selectedEntry.rule_scope || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Tip regulă</Typography>
                  <Typography variant="body2">{selectedEntry.rule_type || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Acțiune</Typography>
                  <Typography variant="body2">{selectedEntry.action_type || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Valoare</Typography>
                  <Typography variant="body2">{selectedEntry.action_value || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Utilizator</Typography>
                  <Typography variant="body2">{selectedEntry.triggered_by_name || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Rezultat</Typography>
                  <Box>
                    {selectedEntry.blocked
                      ? <Chip icon={<BlockIcon />} label="BLOCAT" size="small" color="error" />
                      : <Chip icon={<CheckCircleIcon />} label="PERMIS" size="small" color="success" />
                    }
                  </Box>
                </Grid>
              </Grid>

              {selectedEntry.context_snapshot && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Context Snapshot (date la momentul deciziei):
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.5, bgcolor: 'grey.900', borderRadius: 1, maxHeight: 300, overflowY: 'auto' }}
                    >
                      <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'grey.100' }}>
                        {JSON.stringify(selectedEntry.context_snapshot, null, 2)}
                      </Typography>
                    </Paper>
                  </Box>
                </>
              )}
            </Stack>
          </Box>
        )}
      </Drawer>
      </>}
    </Box>
  );
}
