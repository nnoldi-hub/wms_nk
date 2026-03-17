import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Typography, Box, Button, Chip, CircularProgress,
  Divider, Stack, Alert, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Paper,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import InventoryIcon from '@mui/icons-material/Inventory';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ContentCutIcon from '@mui/icons-material/ContentCut';

const API = 'http://localhost:3011/api/v1';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  RECEIVING: 'warning',
  RECEIVED: 'success',
  CLOSED: 'default',
  CANCELLED: 'error',
};

interface POSummary {
  id: string;
  order_number: string;
  supplier_name: string;
  status: string;
  created_at: string;
  delivery_date?: string;
}

interface PendingBatch {
  id: string;
  batch_number: string;
  product_name: string;
}

interface SalesOrder {
  id: string;
  number: string;
  customer_name?: string;
  delivery_date?: string;
  priority?: string;
  status?: string;
}

interface ZoneStock {
  zone: string;
  batch_count: number;
  total_qty: number;
}

export const DashboardPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const hdrs = { Authorization: `Bearer ${token}` };

  const [pos, setPos] = useState<POSummary[]>([]);
  const [pendingPutaway, setPendingPutaway] = useState<PendingBatch[]>([]);
  const [overdueOrders, setOverdueOrders] = useState<SalesOrder[]>([]);
  const [resturiCount, setResturiCount] = useState(0);
  const [resturiQty, setResturiQty] = useState(0);
  const [zoneStock, setZoneStock] = useState<ZoneStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [poRes, paRes, overdueRes, statsRes] = await Promise.all([
          fetch(`${API}/purchase-orders`, { headers: hdrs }),
          fetch(`${API}/batches/pending-putaway`, { headers: hdrs }),
          fetch(`${API}/orders?overdue=true&limit=10`, { headers: hdrs }),
          fetch(`${API}/batches/dashboard-stats`, { headers: hdrs }),
        ]);
        const poJ = await poRes.json() as { success: boolean; data?: POSummary[] };
        const paJ = await paRes.json() as { success: boolean; data?: PendingBatch[] };
        const ovJ = await overdueRes.json() as { success: boolean; data?: SalesOrder[] };
        const stJ = await statsRes.json() as {
          success: boolean;
          data?: { resturi_count: number; resturi_total_qty: number; stock_by_zone: ZoneStock[] };
        };
        if (poJ.success) setPos(poJ.data || []);
        if (paJ.success) setPendingPutaway(paJ.data || []);
        if (ovJ.success) setOverdueOrders(ovJ.data || []);
        if (stJ.success && stJ.data) {
          setResturiCount(stJ.data.resturi_count);
          setResturiQty(stJ.data.resturi_total_qty);
          setZoneStock(stJ.data.stock_by_zone || []);
        }
      } catch (e) {
        setError('Nu s-au putut încărca datele dashboard. Verifică că serviciile sunt pornite.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const poReceiving = pos.filter(p => p.status === 'RECEIVING').length;
  const poActive = pos.filter(p => ['CONFIRMED', 'RECEIVING'].includes(p.status)).length;
  const putawayCount = pendingPutaway.length;
  const overdueCount = overdueOrders.length;

  const recentPos = [...pos]
    .filter(p => ['CONFIRMED', 'RECEIVING', 'RECEIVED'].includes(p.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 7);

  const widgets = [
    {
      title: 'PO în Recepție Activă',
      value: poReceiving,
      subtitle: 'status RECEIVING',
      icon: <MoveToInboxIcon fontSize="large" />,
      color: poReceiving > 0 ? '#f57c00' : '#388e3c',
      path: '/comenzi-furnizor',
      urgent: poReceiving > 0,
    },
    {
      title: 'Putaway Pending',
      value: putawayCount,
      subtitle: 'loturi fără locație',
      icon: <MoveDownIcon fontSize="large" />,
      color: putawayCount > 0 ? '#d32f2f' : '#388e3c',
      path: '/putaway-tasks',
      urgent: putawayCount > 0,
    },
    {
      title: 'Comenzi Furnizor Active',
      value: poActive,
      subtitle: 'confirmate + în curs',
      icon: <PendingActionsIcon fontSize="large" />,
      color: '#1976d2',
      path: '/comenzi-furnizor',
      urgent: false,
    },
    {
      title: 'Scanare WMS',
      value: '→',
      subtitle: 'mod PUTAWAY disponibil',
      icon: <QrCodeScannerIcon fontSize="large" />,
      color: '#388e3c',
      path: '/scan',
      urgent: false,
    },
    {
      title: 'Comenzi Întârziate',
      value: overdueCount,
      subtitle: 'termen depășit, nelivrate',
      icon: <WarningAmberIcon fontSize="large" />,
      color: overdueCount > 0 ? '#b71c1c' : '#388e3c',
      path: '/orders',
      urgent: overdueCount > 0,
    },
    {
      title: 'Resturi Disponibile',
      value: resturiCount,
      subtitle: resturiCount > 0 ? `${Math.round(resturiQty).toLocaleString('ro-RO')} m total` : 'niciun rest activ',
      icon: <ContentCutIcon fontSize="large" />,
      color: resturiCount > 0 ? '#7b1fa2' : '#388e3c',
      path: '/batches',
      urgent: false,
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Widgets ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {widgets.map((w) => (
          <Grid key={w.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                height: '100%', cursor: 'pointer',
                border: w.urgent ? '2px solid' : undefined,
                borderColor: w.urgent ? w.color : undefined,
                transition: 'all .15s',
                '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
              }}
              onClick={() => navigate(w.path)}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography color="textSecondary" variant="body2" gutterBottom>{w.title}</Typography>
                    {loading
                      ? <CircularProgress size={28} />
                      : <Typography variant="h3" fontWeight={700}
                          sx={{ color: w.urgent ? w.color : 'text.primary' }}>
                          {w.value}
                        </Typography>
                    }
                    <Typography variant="caption" color="text.secondary">{w.subtitle}</Typography>
                  </Box>
                  <Box sx={{ color: w.color, mt: 0.5 }}>{w.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Tabele ── */}
      <Grid container spacing={3}>

        {/* Comenzi furnizor recente */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Comenzi Furnizor Recente</Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/comenzi-furnizor')}>
              Toate comenzile
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Nr. Comandă', 'Furnizor', 'Status', 'Termen', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && recentPos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle', opacity: 0.4 }} />
                      Nicio comandă activă
                    </TableCell>
                  </TableRow>
                )}
                {recentPos.map(po => (
                  <TableRow key={po.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                      {po.order_number}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{po.supplier_name}</TableCell>
                    <TableCell>
                      <Chip label={po.status} size="small" color={STATUS_COLORS[po.status] || 'default'} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {po.delivery_date ? po.delivery_date.slice(0, 10) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate(`/receptie-nir?po=${po.id}`)}
                        disabled={['RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status)}
                      >
                        NIR
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {/* Putaway tasks pending */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6">Putaway Pending</Typography>
              {!loading && putawayCount > 0 && (
                <Chip label={putawayCount} color="error" size="small" />
              )}
            </Stack>
            <Button size="small" endIcon={<ArrowForwardIcon />}
              onClick={() => navigate('/putaway-tasks')}>
              Gestionează
            </Button>
          </Box>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            {loading && <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>}
            {!loading && pendingPutaway.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 40, mb: 1 }} />
                <Typography color="success.main" fontWeight={700}>
                  Toate loturile au locație asignată!
                </Typography>
              </Box>
            )}
            <Stack divider={<Divider />}>
              {pendingPutaway.slice(0, 7).map(b => (
                <Box key={b.id} sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={700} fontSize="0.82rem">
                      {b.batch_number}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{b.product_name}</Typography>
                  </Box>
                  <Chip label="fără locație" size="small" color="warning" variant="outlined" />
                </Box>
              ))}
              {pendingPutaway.length > 7 && (
                <Box sx={{ px: 2, py: 1, color: 'text.secondary', fontSize: '0.8rem' }}>
                  +{pendingPutaway.length - 7} loturi în așteptare...
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Comenzi clienți întârziate */}
        {overdueCount > 0 && (
          <Grid size={{ xs: 12, md: 7 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <WarningAmberIcon color="error" />
                <Typography variant="h6" color="error.main">Comenzi Clienți Întârziate</Typography>
                <Chip label={overdueCount} color="error" size="small" />
              </Stack>
              <Button size="small" color="error" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/orders')}>
                Vezi toate
              </Button>
            </Box>
            <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: 'error.light' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fff3f3' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Cmd</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Termen</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Prioritate</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overdueOrders.slice(0, 7).map(o => (
                    <TableRow key={o.id} sx={{ bgcolor: '#fff8f8' }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.number}</TableCell>
                      <TableCell>{o.customer_name ?? '—'}</TableCell>
                      <TableCell sx={{ color: 'error.main', fontWeight: 700 }}>
                        {o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('ro-RO') : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={o.priority ?? 'NORMAL'}
                          color={o.priority === 'URGENT' ? 'error' : o.priority === 'HIGH' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{o.status ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {overdueOrders.length > 7 && (
                <Box sx={{ px: 2, py: 1, color: 'error.main', fontSize: '0.8rem' }}>
                  +{overdueOrders.length - 7} comenzi întârziate suplimentare...
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Stoc per Zonă (S4.4) */}
        {zoneStock.length > 0 && (
          <Grid size={{ xs: 12, md: 5 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="h6">Stoc per Zonă</Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/harta-depozit')}>
                Hartă
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Zonă</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Loturi</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Cantitate (m)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {zoneStock.map(z => (
                    <TableRow key={z.zone} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{z.zone}</TableCell>
                      <TableCell align="right">
                        <Chip label={z.batch_count} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {Number(z.total_qty).toLocaleString('ro-RO')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        )}

      </Grid>
    </Box>
  );
};
