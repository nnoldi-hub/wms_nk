import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, Button,
  Tab, Tabs, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, CircularProgress, Alert, Tooltip,
  ButtonGroup, Card, CardContent,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadingIcon from '@mui/icons-material/Downloading';
import UploadIcon from '@mui/icons-material/Upload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import erpService from '../services/erp.service';
import type { SyncStatus, SyncJob, ERPPo, WebhookLog } from '../services/erp.service';

function StatusChip({ value, trueLabel = 'Activ', falseLabel = 'Inactiv' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <Chip
      label={value ? trueLabel : falseLabel}
      color={value ? 'success' : 'default'}
      size="small"
    />
  );
}

function JobStatusChip({ status }: { status: string }) {
  const map: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
    SUCCESS: 'success',
    FAILED: 'error',
    PARTIAL: 'warning',
    RUNNING: 'info',
  };
  return <Chip label={status} color={map[status] ?? 'default'} size="small" />;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ro-RO');
}

function fmtDuration(start: string | null, end: string | null) {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
interface TabPanelProps { children: React.ReactNode; idx: number; value: number }
function TabPanel({ children, idx, value }: TabPanelProps) {
  return <div hidden={value !== idx}>{value === idx && <Box mt={2}>{children}</Box>}</div>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ERPIntegrationPage() {
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [pos, setPos] = useState<ERPPo[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, jb, po, wh] = await Promise.all([
        erpService.getStatus(),
        erpService.getJobs(),
        erpService.getPOs(),
        erpService.getWebhookLogs(),
      ]);
      setStatus(st);
      setJobs(jb);
      setPos(po);
      setWebhooks(wh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la încărcare date ERP');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const handleTrigger = async (type: 'ALL' | 'PO_INBOUND' | 'NIR_OUTBOUND' | 'DELIVERY_OUTBOUND') => {
    setTriggering(type);
    setSuccess(null);
    setError(null);
    try {
      await erpService.triggerSync(type);
      setSuccess(`Sincronizare "${type}" pornită. Datele se actualizează în câteva secunde.`);
      setTimeout(() => void loadAll(), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la pornire sincronizare');
    } finally {
      setTriggering(null);
    }
  };

  const successJobs  = jobs.filter(j => j.status === 'SUCCESS').length;
  const failedJobs   = jobs.filter(j => j.status === 'FAILED').length;
  const syncedNIRs   = jobs.filter(j => j.type === 'NIR_OUTBOUND'       && j.status === 'SUCCESS').reduce((s, j) => s + j.records_synced, 0);
  const syncedDelvs  = jobs.filter(j => j.type === 'DELIVERY_OUTBOUND'  && j.status === 'SUCCESS').reduce((s, j) => s + j.records_synced, 0);

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>🔗 Integrare ERP Pluriva</Typography>
          <Typography variant="body2" color="text.secondary">
            Sincronizare bidirectionalā WMS ↔ Pluriva ERP
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => void loadAll()}
          disabled={loading}
        >
          Reîncarcă
        </Button>
      </Box>

      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Connection status banner */}
      {status && (
        <Card sx={{ mb: 3, bgcolor: status.isDemo ? 'warning.lighter' : 'success.lighter', border: '1px solid', borderColor: status.isDemo ? 'warning.main' : 'success.main' }}>
          <CardContent sx={{ pb: '12px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
            {status.isDemo ? <CloudOffIcon color="warning" /> : <CloudDoneIcon color="success" />}
            <Box flex={1}>
              <Typography fontWeight={600}>
                {status.isDemo ? 'Mod Demonstrativ (API Key neconfiguratā)' : 'Conectat la Pluriva ERP'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Interval sincronizare: {status.syncInterval / 1000}s
                {status.lastSync && ` · Ultima sinc: ${fmtDate(status.lastSync)}`}
                {status.lastSyncType && ` (${status.lastSyncType})`}
              </Typography>
            </Box>
            <StatusChip value={!status.isDemo} trueLabel="Live" falseLabel="Demo" />
            <StatusChip value={status.isRunning} trueLabel="Sincronizare în curs" falseLabel="În așteptare" />
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Comenzi ERP importate"    value={pos.length}        sub="total PO-uri" /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Joburi reușite"           value={successJobs}       sub="din ultimele 50" /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="NIR-uri sincronizate"     value={syncedNIRs}        sub="trimise la ERP" /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Livrări sincronizate"     value={syncedDelvs}       sub="trimise la ERP" /></Grid>
      </Grid>

      {/* Manual trigger buttons */}
      <Box mb={3}>
        <Typography variant="subtitle2" mb={1}>Sincronizare manuală:</Typography>
        <ButtonGroup variant="outlined" size="small">
          <Button
            startIcon={triggering === 'ALL' ? <CircularProgress size={14} /> : <SyncIcon />}
            disabled={!!triggering}
            onClick={() => void handleTrigger('ALL')}
          >
            Toate
          </Button>
          <Button
            startIcon={triggering === 'PO_INBOUND' ? <CircularProgress size={14} /> : <DownloadingIcon />}
            disabled={!!triggering}
            onClick={() => void handleTrigger('PO_INBOUND')}
          >
            PO Import
          </Button>
          <Button
            startIcon={triggering === 'NIR_OUTBOUND' ? <CircularProgress size={14} /> : <UploadIcon />}
            disabled={!!triggering}
            onClick={() => void handleTrigger('NIR_OUTBOUND')}
          >
            NIR Export
          </Button>
          <Button
            startIcon={triggering === 'DELIVERY_OUTBOUND' ? <CircularProgress size={14} /> : <LocalShippingIcon />}
            disabled={!!triggering}
            onClick={() => void handleTrigger('DELIVERY_OUTBOUND')}
          >
            Livrări Export
          </Button>
        </ButtonGroup>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v as number)}>
          <Tab label={`PO-uri ERP (${pos.length})`} />
          <Tab label={`Istoric Sincronizare (${jobs.length})`} />
          <Tab label={`Webhooks (${webhooks.length})`} />
        </Tabs>
      </Box>

      {/* Tab 0: POs */}
      <TabPanel idx={0} value={tab}>
        {pos.length === 0 ? (
          <Alert severity="info">Nu există comenzi ERP importate. Apăsați &quot;PO Import&quot; pentru sincronizare.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ERP PO ID</TableCell>
                  <TableCell>Furnizor</TableCell>
                  <TableCell>Cod Furnizor</TableCell>
                  <TableCell>Status ERP</TableCell>
                  <TableCell>Dată Comandă</TableCell>
                  <TableCell>Livrare Estimată</TableCell>
                  <TableCell>Linii</TableCell>
                  <TableCell>Creat</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pos.map(po => (
                  <TableRow key={po.id} hover>
                    <TableCell><code>{po.erp_po_id}</code></TableCell>
                    <TableCell>{po.supplier_name ?? '—'}</TableCell>
                    <TableCell>{po.supplier_code ?? '—'}</TableCell>
                    <TableCell>
                      <Chip label={po.erp_status ?? 'N/A'} size="small"
                        color={po.erp_status === 'CONFIRMED' ? 'success' : po.erp_status === 'CANCELLED' ? 'error' : 'default'} />
                    </TableCell>
                    <TableCell>{po.order_date ?? '—'}</TableCell>
                    <TableCell>{po.expected_delivery ?? '—'}</TableCell>
                    <TableCell>{Array.isArray(po.lines_json) ? po.lines_json.length : 0}</TableCell>
                    <TableCell>{fmtDate(po.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 1: Jobs */}
      <TabPanel idx={1} value={tab}>
        {jobs.length === 0 ? (
          <Alert severity="info">Nu există joburi de sincronizare înregistrate.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tip</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Înreg. procesate</TableCell>
                  <TableCell>Pornit la</TableCell>
                  <TableCell>Finalizat la</TableCell>
                  <TableCell>Durată</TableCell>
                  <TableCell>Eroare</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id} hover>
                    <TableCell><Chip label={job.type} size="small" variant="outlined" /></TableCell>
                    <TableCell><JobStatusChip status={job.status} /></TableCell>
                    <TableCell align="right">{job.records_synced}</TableCell>
                    <TableCell>{fmtDate(job.started_at)}</TableCell>
                    <TableCell>{fmtDate(job.completed_at)}</TableCell>
                    <TableCell>{fmtDuration(job.started_at, job.completed_at)}</TableCell>
                    <TableCell>
                      {job.error_msg
                        ? <Tooltip title={job.error_msg}><Typography variant="caption" color="error" sx={{ cursor: 'help' }}>Eroare ⚠</Typography></Tooltip>
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 2: Webhooks */}
      <TabPanel idx={2} value={tab}>
        {webhooks.length === 0 ? (
          <Alert severity="info">Nu există webhook-uri primite de la ERP.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tip Eveniment</TableCell>
                  <TableCell>PO ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Primit la</TableCell>
                  <TableCell>Eroare</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooks.map(wh => (
                  <TableRow key={wh.id} hover>
                    <TableCell><Chip label={wh.event_type} size="small" /></TableCell>
                    <TableCell><code>{wh.erp_po_id ?? '—'}</code></TableCell>
                    <TableCell>
                      <Chip label={wh.status} size="small"
                        color={wh.status === 'PROCESSED' ? 'success' : wh.status === 'FAILED' ? 'error' : 'default'} />
                    </TableCell>
                    <TableCell>{fmtDate(wh.received_at)}</TableCell>
                    <TableCell>
                      {wh.error_msg
                        ? <Tooltip title={wh.error_msg}><Typography variant="caption" color="error" sx={{ cursor: 'help' }}>Eroare ⚠</Typography></Tooltip>
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {loading && (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      )}

      {failedJobs > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {failedJobs} job(uri) de sincronizare au eșuat. Verificați tab-ul &quot;Istoric Sincronizare&quot;.
        </Alert>
      )}
    </Box>
  );
}
