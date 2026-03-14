/**
 * ShipmentsPage — Board de expediere WMS NK
 *
 * Afișează comenzile de vânzare grupate pe statusuri de expediere:
 *   COMPLETED picking → READY_FOR_LOADING → LOADED → DELIVERED
 *
 * Acțiuni disponibile:
 *  - "Mută în zona livrare" (picking job COMPLETED → DISPATCHED, comandă → READY_FOR_LOADING)
 *  - "Marchează LOADED" (comandă → LOADED)
 *  - "Marchează DELIVERED" (comandă → DELIVERED)
 */

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box, Button, Typography, Stack, Chip, Alert, Snackbar,
  Table, TableHead, TableRow, TableCell, TableBody, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Tabs, Tab, LinearProgress,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory';
import RefreshIcon from '@mui/icons-material/Refresh';
import { pickingService, type PickJob } from '../services/picking.service';

const INVENTORY_API = 'http://localhost:3011/api/v1';
const apiClient = axios.create({ baseURL: INVENTORY_API });
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers = (config.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${token}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.headers = headers as any;
  }
  return config;
});

interface Order {
  id: string;
  number: string;
  customer_name: string;
  status: string;
  delivery_type?: string;
  agent_name?: string;
  delivery_address?: string;
  created_at: string;
  loaded_at?: string;
  loaded_by?: string;
  vehicle_number?: string;
  driver_name?: string;
  delivered_at?: string;
}

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  COMPLETED: 'info',
  DISPATCHED: 'info',
  READY_FOR_LOADING: 'warning',
  LOADED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
};

const TAB_STATUSES = [
  { label: 'Picking gata', status: 'READY_FOR_LOADING', icon: <InventoryIcon fontSize="small" /> },
  { label: 'Încărcat', status: 'LOADED', icon: <LocalShippingIcon fontSize="small" /> },
  { label: 'Livrat', status: 'DELIVERED', icon: <CheckCircleIcon fontSize="small" /> },
];

export function ShipmentsPage() {
  const [tabIdx, setTabIdx] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedJobs, setCompletedJobs] = useState<PickJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [busy, setBusy] = useState<string | null>(null);

  // Dialog LOADED (mașina, șofer, notă)
  const [loadedDialog, setLoadedDialog] = useState<{ open: boolean; orderId: string; orderNumber: string }>({ open: false, orderId: '', orderNumber: '' });
  const [loadedNote, setLoadedNote] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tabIdx === 0) {
        // Tab 0: joburi COMPLETED ce pot fi mutate în expediere + comenzi READY_FOR_LOADING
        const [jobsRes, ordersRes] = await Promise.all([
          pickingService.list({ status: 'COMPLETED', limit: 100 }),
          apiClient.get<{ data: Order[] }>('/orders', { params: { status: 'READY_FOR_LOADING', limit: 100 } }),
        ]);
        setCompletedJobs(jobsRes.data ?? []);
        setOrders(ordersRes.data?.data ?? []);
      } else {
        // Tab 1: LOADED, Tab 2: DELIVERED
        const status = TAB_STATUSES[tabIdx]?.status ?? 'LOADED';
        const ordersRes = await apiClient.get<{ data: Order[] }>('/orders', { params: { status, limit: 100 } });
        setOrders(ordersRes.data?.data ?? []);
        setCompletedJobs([]);
      }
    } catch {
      showSnack('Eroare la incarcarea datelor', 'error');
    } finally {
      setLoading(false);
    }
  }, [tabIdx]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleMoveToShipping = async (jobId: string) => {
    setBusy(jobId);
    try {
      const res = await pickingService.moveToShipping(jobId);
      const orderNum = res.data.order?.number ?? '';
      showSnack(`Mutat in zona expediere${orderNum ? ` — Comanda ${orderNum}: READY_FOR_LOADING` : ''}`);
      void fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Eroare';
      showSnack(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleMarkLoaded = async () => {
    if (!loadedDialog.orderId) return;
    setBusy(loadedDialog.orderId);
    try {
      await apiClient.patch(`/orders/${loadedDialog.orderId}/status`, {
        status: 'LOADED',
        notes: loadedNote || undefined,
        vehicle_number: vehicleNumber.trim() || undefined,
        driver_name: driverName.trim() || undefined,
      });
      showSnack(`Comanda ${loadedDialog.orderNumber} marcata LOADED`);
      setLoadedDialog({ open: false, orderId: '', orderNumber: '' });
      setLoadedNote('');
      setVehicleNumber('');
      setDriverName('');
      void fetchData();
    } catch {
      showSnack('Eroare la actualizare status', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleMarkDelivered = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Marchezi comanda ${orderNumber} ca DELIVERED?`)) return;
    setBusy(orderId);
    try {
      await apiClient.patch(`/orders/${orderId}/status`, { status: 'DELIVERED' });
      showSnack(`Comanda ${orderNumber} marcata DELIVERED`);
      void fetchData();
    } catch {
      showSnack('Eroare la actualizare status', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          <LocalShippingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Expediere
        </Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void fetchData()} disabled={loading}>
          Actualizează
        </Button>
      </Stack>

      <Tabs value={tabIdx} onChange={(_, v: number) => setTabIdx(v)} sx={{ mb: 2 }}>
        <Tab label="Pregătit pentru livrare" />
        <Tab label="Încărcat în mașină" />
        <Tab label="Livrat" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* TAB 0: Joburi complete + comenzi READY_FOR_LOADING */}
      {tabIdx === 0 && (
        <Stack spacing={3}>
          {/* Secțiunea A: Picking jobs COMPLETED — pot fi mutate în expediere */}
          {completedJobs.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1} color="primary">
                Joburi picking finalizate — mutare în zona expediere
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Job #</TableCell>
                    <TableCell>Comanda ID</TableCell>
                    <TableCell>Asignat</TableCell>
                    <TableCell>Finalizat</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Acțiuni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {completedJobs.map(j => (
                    <TableRow key={j.id}>
                      <TableCell><b>{j.number}</b></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{j.order_id?.substring(0, 8) ?? '—'}…</TableCell>
                      <TableCell>{j.assigned_to ?? '—'}</TableCell>
                      <TableCell>{j.completed_at ? new Date(j.completed_at).toLocaleString('ro-RO') : '—'}</TableCell>
                      <TableCell><Chip size="small" label={j.status} color={STATUS_COLORS[j.status] ?? 'default'} /></TableCell>
                      <TableCell>
                        <Tooltip title="Mută marfa în zona de expediere și setează comanda ca READY_FOR_LOADING">
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              startIcon={<LocalShippingIcon />}
                              onClick={() => void handleMoveToShipping(j.id)}
                              disabled={busy === j.id}
                            >
                              {busy === j.id ? 'Se procesează…' : 'Mută în expediere'}
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {completedJobs.length === 0 && orders.length === 0 && !loading && (
            <Alert severity="info">Nu există comenzi în pregătire pentru expediere.</Alert>
          )}

          {/* Secțiunea B: Comenzi READY_FOR_LOADING — așteptând încărcarea */}
          {orders.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1} color="warning.main">
                Comenzi READY_FOR_LOADING — în așteptarea încărcării
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Comanda #</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell>Tip livrare</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Acțiuni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell><b>{o.number}</b></TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell>{o.agent_name ?? '—'}</TableCell>
                      <TableCell>{o.delivery_type ?? '—'}</TableCell>
                      <TableCell><Chip size="small" label={o.status} color="warning" /></TableCell>
                      <TableCell>
                        <Tooltip title="Marchează comanda ca LOADED — marfa e în mașină">
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<LocalShippingIcon />}
                            onClick={() => { setLoadedDialog({ open: true, orderId: o.id, orderNumber: o.number }); setLoadedNote(''); setVehicleNumber(''); setDriverName(''); }}
                            disabled={!!busy}
                          >
                            Marchează LOADED
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      )}

      {/* TAB 1: LOADED — comenzi în transport */}
      {tabIdx === 1 && (
        <Box>
          {orders.length === 0 && !loading && (
            <Alert severity="info">Nu există comenzi cu status LOADED.</Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Comanda #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Adresă livrare</TableCell>
                <TableCell>Mașina</TableCell>
                <TableCell>Șofer</TableCell>
                <TableCell>Încărcat la</TableCell>
                <TableCell>Acțiuni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell><b>{o.number}</b></TableCell>
                  <TableCell>{o.customer_name}</TableCell>
                  <TableCell>{o.delivery_address ?? '—'}</TableCell>
                  <TableCell>{o.vehicle_number ?? '—'}</TableCell>
                  <TableCell>{o.driver_name ?? '—'}</TableCell>
                  <TableCell>{o.loaded_at ? new Date(o.loaded_at).toLocaleString('ro-RO') : '—'}</TableCell>
                  <TableCell>
                    <Tooltip title="Marchează DELIVERED — livrare confirmată">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => void handleMarkDelivered(o.id, o.number)}
                        disabled={busy === o.id}
                      >
                        {busy === o.id ? 'Se procesează…' : 'Confirmă livrarea'}
                      </Button>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* TAB 2: DELIVERED — arhivă */}
      {tabIdx === 2 && (
        <Box>
          {orders.length === 0 && !loading && (
            <Alert severity="info">Nu există comenzi livrate.</Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Comanda #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Adresă</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Mașina</TableCell>
                <TableCell>Șofer</TableCell>
                <TableCell>Livrat la</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell><b>{o.number}</b></TableCell>
                  <TableCell>{o.customer_name}</TableCell>
                  <TableCell>{o.delivery_address ?? '—'}</TableCell>
                  <TableCell>{o.agent_name ?? '—'}</TableCell>
                  <TableCell>{o.vehicle_number ?? '—'}</TableCell>
                  <TableCell>{o.driver_name ?? '—'}</TableCell>
                  <TableCell>{o.delivered_at ? new Date(o.delivered_at).toLocaleString('ro-RO') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Dialog confirmare LOADED */}
      <Dialog
        open={loadedDialog.open}
        onClose={() => { setLoadedDialog({ open: false, orderId: '', orderNumber: '' }); setVehicleNumber(''); setDriverName(''); setLoadedNote(''); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocalShippingIcon color="primary" />
            <span>Marchează LOADED — {loadedDialog.orderNumber}</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Confirmați că marfa comenzii <b>{loadedDialog.orderNumber}</b> a fost încărcată în vehicul.
          </Alert>
          <Stack spacing={2}>
            <TextField
              label="Nr. înmatriculare mașina"
              fullWidth
              placeholder="ex: B-123-XYZ"
              value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value)}
            />
            <TextField
              label="Nume șofer"
              fullWidth
              placeholder="ex: Ion Popescu"
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
            />
            <TextField
              label="Notă suplimentară (opțional)"
              fullWidth
              multiline
              rows={2}
              value={loadedNote}
              onChange={e => setLoadedNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setLoadedDialog({ open: false, orderId: '', orderNumber: '' }); setVehicleNumber(''); setDriverName(''); setLoadedNote(''); }}>Anulează</Button>
          <Button variant="contained" startIcon={<LocalShippingIcon />} onClick={() => void handleMarkLoaded()} disabled={!!busy}>
            Confirmă LOADED
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ShipmentsPage;

