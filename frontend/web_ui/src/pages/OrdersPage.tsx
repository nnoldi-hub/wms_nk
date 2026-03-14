import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, Snackbar, Alert, IconButton, Tooltip,
  Chip, Stack, Select, MenuItem, FormControl, InputLabel,
  ToggleButton, ToggleButtonGroup, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, LinearProgress,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowsProp, type GridPaginationModel } from '@mui/x-data-grid';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PrintIcon from '@mui/icons-material/Print';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddTaskIcon from '@mui/icons-material/AddTask';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import FilterListIcon from '@mui/icons-material/FilterList';
import { ordersService, type Order } from '../services/orders.service';
import { OrderImportDialog } from '../components/OrderImportDialog';
import { OrderDetailsDialog } from '../components/OrderDetailsDialog';
import PermissionGuard from '../components/PermissionGuard';
import { usePermissions } from '../hooks/usePermissions';

const ERP_ORDERS_URL_KEY = 'wms_erp_orders_url';
const API = 'http://localhost:3011/api/v1';

const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
  URGENT: 'error',
  HIGH: 'warning',
  NORMAL: 'default',
};

const STATUS_OPTIONS = ['', 'PENDING', 'ALLOCATED', 'PICKING', 'PACKED', 'SHIPPED', 'CANCELLED'];
const PRIORITY_OPTIONS = ['', 'URGENT', 'HIGH', 'NORMAL'];

function isOverdue(row: Order): boolean {
  if (!row.delivery_date) return false;
  return new Date(row.delivery_date) < new Date() && !['SHIPPED', 'CANCELLED'].includes(row.status || '');
}

export const OrdersPage = () => {
  const { can } = usePermissions('orders');
  const [rows, setRows] = useState<GridRowsProp>([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [rowCount, setRowCount] = useState(0);
  const [openImport, setOpenImport] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);

  // ERP Sync dialog
  const [erpOpen, setErpOpen] = useState(false);
  const [erpUrl, setErpUrl] = useState(() => localStorage.getItem(ERP_ORDERS_URL_KEY) || '');
  const [erpApiKey, setErpApiKey] = useState('');
  const [erpLoading, setErpLoading] = useState(false);
  const [erpError, setErpError] = useState('');
  const [erpPreview, setErpPreview] = useState<Order[]>([]);
  const [erpResult, setErpResult] = useState<{ imported: number; skipped: number } | null>(null);
  const erpImporting = useRef(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const resp = await ordersService.list({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        overdue: filterOverdue || undefined,
      });
      setRows(resp.data.map((o) => ({ ...o, id: o.id })));
      if (typeof resp.pagination?.total === 'number') setRowCount(resp.pagination.total);
    } catch {
      setSnackbar({ open: true, message: 'Eroare la incarcarea comenzilor', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationModel.page, paginationModel.pageSize, filterStatus, filterPriority, filterOverdue]);

  const handleImportSuccess = () => {
    setSnackbar({ open: true, message: 'Comenzi importate cu succes', severity: 'success' });
    void fetchOrders();
  };

  const handleErpFetch = async () => {
    if (!erpUrl) return;
    localStorage.setItem(ERP_ORDERS_URL_KEY, erpUrl);
    setErpLoading(true);
    setErpError('');
    setErpPreview([]);
    setErpResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (erpApiKey) headers['X-Api-Key'] = erpApiKey;
      const resp = await fetch(erpUrl, { headers });
      if (!resp.ok) throw new Error(`ERP HTTP ${resp.status}`);
      const data: unknown = await resp.json();
      const orders: Order[] = Array.isArray(data) ? (data as Order[])
        : ((data as Record<string, unknown>)?.orders as Order[])
        ?? ((data as Record<string, unknown>)?.data as Order[])
        ?? [];
      if (!orders.length) throw new Error('ERP-ul nu a returnat comenzi');
      setErpPreview(orders);
    } catch (e: unknown) {
      setErpError(e instanceof Error ? e.message : 'Eroare conexiune ERP');
    } finally {
      setErpLoading(false);
    }
  };

  const handleErpImport = async () => {
    if (erpImporting.current || !erpPreview.length) return;
    erpImporting.current = true;
    setErpLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const resp = await fetch(`${API}/orders/import-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ orders: erpPreview, source: 'ERP_SYNC' }),
      });
      const body = await resp.json() as { success: boolean; data?: { orders?: Order[]; skipped?: unknown[] }; message?: string };
      if (!body.success) throw new Error(body.message || 'Import esuat');
      setErpResult({ imported: body.data?.orders?.length ?? 0, skipped: body.data?.skipped?.length ?? 0 });
      void fetchOrders();
    } catch (e: unknown) {
      setErpError(e instanceof Error ? e.message : 'Eroare la import');
    } finally {
      setErpLoading(false);
      erpImporting.current = false;
    }
  };

  const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
    PENDING: 'warning', ALLOCATED: 'info', PICKING: 'info', PACKED: 'success', SHIPPED: 'success', CANCELLED: 'error',
  };

  const columns: GridColDef[] = [
    { field: 'number', headerName: 'CMD', width: 140 },
    {
      field: 'priority', headerName: 'Prioritate', width: 130,
      renderCell: (p) => {
        const row = p.row as Order;
        const prio = (row.priority as string) || 'NORMAL';
        const overdue = isOverdue(row);
        return (
          <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
            <Chip size="small" label={prio} color={PRIORITY_COLORS[prio] ?? 'default'} />
            {overdue && <Tooltip title="Termen depasit!"><WarningAmberIcon color="error" fontSize="small" /></Tooltip>}
          </Stack>
        );
      },
    },
    { field: 'customer_name', headerName: 'Client', width: 220 },
    {
      field: 'delivery_date', headerName: 'Termen Livrare', width: 150,
      renderCell: (p) => {
        const row = p.row as Order;
        const dd = row.delivery_date as string | undefined;
        if (!dd) return <Typography variant="caption" color="text.secondary">—</Typography>;
        const overdue = isOverdue(row);
        return (
          <Typography variant="body2" color={overdue ? 'error' : 'text.primary'} fontWeight={overdue ? 700 : 400}>
            {new Date(dd).toLocaleDateString('ro-RO')}
          </Typography>
        );
      },
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => {
        const s = String(p.value ?? '');
        return <Chip size="small" label={s || '—'} color={STATUS_COLORS[s] ?? 'default'} />;
      },
    },
    { field: 'total_weight', headerName: 'Greutate (kg)', width: 130, type: 'number' },
    {
      field: 'created_at', headerName: 'Creat', width: 130,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleDateString('ro-RO') : '—',
    },
    {
      field: 'actions', headerName: 'Actiuni', width: 200, sortable: false,
      renderCell: (params) => {
        const row = params.row as Order;
        return (
          <Box>
            {can('can_create') && (
            <Tooltip title="Genereaza job picking">
              <IconButton size="small" onClick={async () => {
                try {
                  await ordersService.allocatePickingJob(row.id);
                  setSnackbar({ open: true, message: 'Job de picking generat', severity: 'success' });
                  void fetchOrders();
                } catch {
                  setSnackbar({ open: true, message: 'Eroare sau job exista deja', severity: 'error' });
                }
              }}>
                <AddTaskIcon />
              </IconButton>
            </Tooltip>            )}            <Tooltip title="Etichete picking">
              <IconButton size="small" onClick={async () => {
                try {
                  const job = await ordersService.findPickJobByOrder(row.id);
                  if (!job) { setSnackbar({ open: true, message: 'Nu exista job de picking', severity: 'error' }); return; }
                  await ordersService.openLabels(job.id);
                } catch {
                  setSnackbar({ open: true, message: 'Eroare la etichete', severity: 'error' });
                }
              }}>
                <QrCode2Icon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Bon picking PDF">
              <IconButton size="small" onClick={() => window.open(ordersService.getPickNoteUrl(row.id), '_blank')}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Detalii comanda">
              <IconButton size="small" onClick={() => { setSelectedOrderId(row.id); setOpenDetails(true); }}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  const overdueCount = (rows as Order[]).filter(r => isOverdue(r)).length;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5" fontWeight={700}>Comenzi Clienti</Typography>
          {overdueCount > 0 && (
            <Chip icon={<PriorityHighIcon />} label={`${overdueCount} intarziate`} color="error" size="small" />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<SyncIcon />}
            onClick={() => { setErpOpen(true); setErpResult(null); setErpPreview([]); setErpError(''); }}>
            Sync ERP
          </Button>
          <PermissionGuard resource="orders" action="can_create" mode="disable" tooltip="Ai nevoie de permisiunea 'Creare' pe resursa Comenzi">
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setOpenImport(true)}>
              Import CSV
            </Button>
          </PermissionGuard>
        </Stack>
      </Stack>

      {/* Filter bar */}
      <Stack direction="row" spacing={2} mb={2} alignItems="center" flexWrap="wrap">
        <FilterListIcon color="action" />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status"
            onChange={e => { setFilterStatus(e.target.value); setPaginationModel(m => ({ ...m, page: 0 })); }}>
            {STATUS_OPTIONS.map(s => <MenuItem key={s || '__all'} value={s}>{s || 'Toate statusurile'}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Prioritate</InputLabel>
          <Select value={filterPriority} label="Prioritate"
            onChange={e => { setFilterPriority(e.target.value); setPaginationModel(m => ({ ...m, page: 0 })); }}>
            {PRIORITY_OPTIONS.map(p => <MenuItem key={p || '__all'} value={p}>{p || 'Toate prioritatile'}</MenuItem>)}
          </Select>
        </FormControl>
        <ToggleButtonGroup size="small" value={filterOverdue ? 'overdue' : ''} exclusive
          onChange={(_, v) => { setFilterOverdue(v === 'overdue'); setPaginationModel(m => ({ ...m, page: 0 })); }}>
          <ToggleButton value="overdue" sx={{ color: 'error.main', borderColor: 'error.light' }}>
            <WarningAmberIcon fontSize="small" sx={{ mr: 0.5 }} />Intarziate
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{ height: 560, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={rowCount}
          paginationMode="server"
          disableRowSelectionOnClick
          getRowClassName={p => isOverdue(p.row as Order) ? 'row-overdue' : ''}
          sx={{ '& .row-overdue': { bgcolor: '#fff3f3' } }}
        />
      </Box>

      <OrderImportDialog open={openImport} onClose={() => setOpenImport(false)} onSuccess={handleImportSuccess} />
      <OrderDetailsDialog open={openDetails} orderId={selectedOrderId} onClose={() => setOpenDetails(false)} />

      {/* ERP Sync Dialog */}
      <Dialog open={erpOpen} onClose={() => setErpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SyncIcon color="primary" />
            <span>Sincronizare Comenzi din ERP</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!erpResult ? (
            <Stack spacing={2}>
              <Alert severity="info">
                ERP-ul trebuie sa expuna un endpoint GET care returneaza JSON:
                <code style={{ display: 'block', marginTop: 4 }}>{'[{number, customer_name, delivery_date, priority, lines:[...]}]'}</code>
              </Alert>
              <TextField label="URL Endpoint ERP" placeholder="http://erp.company.ro/api/sales-orders"
                value={erpUrl} onChange={e => setErpUrl(e.target.value)} fullWidth />
              <TextField label="API Key (optional)" type="password"
                value={erpApiKey} onChange={e => setErpApiKey(e.target.value)} fullWidth />
              <Button variant="outlined" startIcon={<SyncIcon />}
                onClick={() => void handleErpFetch()} disabled={!erpUrl || erpLoading}>
                {erpLoading ? 'Se conecteaza...' : 'Preia comenzi din ERP'}
              </Button>
              {erpLoading && <LinearProgress />}
              {erpError && <Alert severity="error">{erpError}</Alert>}
              {erpPreview.length > 0 && (
                <Alert severity="success">
                  S-au gasit <strong>{erpPreview.length} comenzi</strong> in ERP. Confirma importul.
                </Alert>
              )}
            </Stack>
          ) : (
            <Box textAlign="center" py={2}>
              <Typography variant="h6" color="success.main">Import finalizat!</Typography>
              <Typography mt={1}><strong>{erpResult.imported}</strong> comenzi importate</Typography>
              {erpResult.skipped > 0 && (
                <Typography color="warning.main">{erpResult.skipped} comenzi existau deja si au fost sarite</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErpOpen(false)}>{erpResult ? 'Inchide' : 'Anuleaza'}</Button>
          {!erpResult && erpPreview.length > 0 && (
            <Button variant="contained" onClick={() => void handleErpImport()} disabled={erpLoading}>
              {erpLoading ? 'Se importa...' : `Importa ${erpPreview.length} comenzi`}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OrdersPage;