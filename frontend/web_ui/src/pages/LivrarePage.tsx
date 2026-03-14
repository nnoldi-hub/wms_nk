/**
 * LivrarePage — Confirmare livrare de către șofer / supervisor
 *
 * Pagina este optimizată pentru mobile (ecran mic, butoane mari).
 * Fluxul:
 *  1. Se afișează comenzile cu status LOADED (pregătite în mașină)
 *  2. Șoferul selectează comanda, vede detalii (client, adresă, mașina, produse)
 *  3. Confirmă livrarea → status devine DELIVERED + delivered_at = NOW()
 *  4. Opțional poate adăuga o notă de livrare (ex: persoana care a semnat)
 */

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box, Typography, Stack, Chip, Button, Alert, Snackbar,
  Card, CardContent, CardActions, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Divider, IconButton, Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

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

interface OrderLine {
  id: string;
  line_no: number;
  product_sku: string;
  description?: string;
  requested_qty: number;
  uom: string;
}

interface Order {
  id: string;
  number: string;
  customer_name: string;
  delivery_address?: string;
  contact_name?: string;
  agent_name?: string;
  delivery_type?: string;
  internal_notes?: string;
  status: string;
  vehicle_number?: string;
  driver_name?: string;
  loaded_at?: string;
  delivered_at?: string;
  lines?: OrderLine[];
}

export function LivrarePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linesCache, setLinesCache] = useState<Record<string, OrderLine[]>>({});
  const [linesLoading, setLinesLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [busy, setBusy] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });
  const [deliveryNote, setDeliveryNote] = useState('');

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Order[] }>('/orders', { params: { status: 'LOADED', limit: 50 } });
      setOrders(res.data?.data ?? []);
    } catch {
      showSnack('Eroare la încărcarea comenzilor', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  const toggleExpand = async (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (!linesCache[orderId]) {
      setLinesLoading(orderId);
      try {
        const res = await apiClient.get<{ data: { lines: OrderLine[] } }>(`/orders/${orderId}`);
        const lines = res.data?.data?.lines ?? [];
        setLinesCache(prev => ({ ...prev, [orderId]: lines }));
      } catch {
        // silently fail — lines just won't show
      } finally {
        setLinesLoading(null);
      }
    }
  };

  const openConfirm = (order: Order) => {
    setConfirmDialog({ open: true, order });
    setDeliveryNote('');
  };

  const handleConfirmDelivery = async () => {
    const order = confirmDialog.order;
    if (!order) return;
    setBusy(order.id);
    try {
      await apiClient.patch(`/orders/${order.id}/status`, {
        status: 'DELIVERED',
        notes: deliveryNote.trim() || undefined,
      });
      showSnack(`Comanda ${order.number} marcată DELIVERED ✓`);
      setConfirmDialog({ open: false, order: null });
      setDeliveryNote('');
      // Remove from list
      setOrders(prev => prev.filter(o => o.id !== order.id));
    } catch {
      showSnack('Eroare la confirmarea livrării', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 640, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LocalShippingIcon color="primary" fontSize="large" />
          <Typography variant="h5" fontWeight={700}>Livrare</Typography>
        </Stack>
        <IconButton onClick={() => void fetchOrders()} disabled={loading} color="primary">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {!loading && orders.length === 0 && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
          Nu există comenzi de livrat. Toate comenzile au fost livrate!
        </Alert>
      )}

      <Stack spacing={2}>
        {orders.map(order => (
          <Card key={order.id} elevation={2} sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent sx={{ pb: 1 }}>
              {/* Comanda # + status */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="h6" fontWeight={700}>{order.number}</Typography>
                <Chip label={order.status} color="warning" size="small" />
              </Stack>

              {/* Client */}
              <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="body1" fontWeight={500}>{order.customer_name}</Typography>
              </Stack>

              {/* Adresă */}
              {order.delivery_address && (
                <Stack direction="row" spacing={1} alignItems="flex-start" mt={0.5}>
                  <PlaceIcon fontSize="small" color="action" sx={{ mt: 0.2 }} />
                  <Typography variant="body2" color="text.secondary">{order.delivery_address}</Typography>
                </Stack>
              )}

              {/* Mașina + șofer */}
              {(order.vehicle_number || order.driver_name) && (
                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                  <DirectionsCarIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {[order.vehicle_number, order.driver_name].filter(Boolean).join(' — ')}
                  </Typography>
                </Stack>
              )}

              {/* Loaded at */}
              {order.loaded_at && (
                <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
                  Încărcat: {new Date(order.loaded_at).toLocaleString('ro-RO')}
                </Typography>
              )}

              {/* Expand linii */}
              <Button
                size="small"
                startIcon={expandedId === order.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => void toggleExpand(order.id)}
                sx={{ mt: 1, textTransform: 'none', p: 0 }}
              >
                {expandedId === order.id ? 'Ascunde produse' : 'Vezi produse'}
              </Button>

              <Collapse in={expandedId === order.id}>
                {linesLoading === order.id && <LinearProgress sx={{ mt: 1 }} />}
                {linesCache[order.id] && linesCache[order.id].length > 0 && (
                  <Box mt={1}>
                    <Divider sx={{ mb: 1 }} />
                    {linesCache[order.id].map(line => (
                      <Stack key={line.id} direction="row" justifyContent="space-between" alignItems="center" py={0.5}>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{line.product_sku}</Typography>
                          {line.description && (
                            <Typography variant="caption" color="text.secondary">{line.description}</Typography>
                          )}
                        </Box>
                        <Chip
                          label={`${line.requested_qty} ${line.uom}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                    ))}
                  </Box>
                )}
                {linesCache[order.id] && linesCache[order.id].length === 0 && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    Nu există linii pentru această comandă.
                  </Typography>
                )}
              </Collapse>
            </CardContent>

            <Divider />

            <CardActions sx={{ px: 2, py: 1.5 }}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                size="large"
                startIcon={<CheckCircleIcon />}
                onClick={() => openConfirm(order)}
                disabled={busy === order.id}
                sx={{ borderRadius: 2, fontWeight: 700, fontSize: '1rem' }}
              >
                {busy === order.id ? 'Se procesează…' : 'CONFIRMĂ LIVRAREA'}
              </Button>
            </CardActions>
          </Card>
        ))}
      </Stack>

      {/* Dialog confirmare DELIVERED */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, order: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <span>Confirmă livrarea — {confirmDialog.order?.number}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Confirmi că marfa comenzii <b>{confirmDialog.order?.number}</b> a fost livrată la{' '}
            <b>{confirmDialog.order?.customer_name}</b>?
          </Alert>
          <TextField
            label="Notă livrare (opțional — persoana care a semnat, observații)"
            fullWidth
            multiline
            rows={3}
            value={deliveryNote}
            onChange={e => setDeliveryNote(e.target.value)}
            placeholder="ex: Semnat de Ion Ionescu, recepție confirmată"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, order: null })}>Anulează</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => void handleConfirmDelivery()}
            disabled={!!busy}
          >
            Confirmă DELIVERED
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

export default LivrarePage;
